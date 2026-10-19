import { serviceDates } from './lifecycle.ts';

export interface HotelInventoryWindow {
  id: string;
  serviceDate: string;
  startAt: string;
  endAt: string;
  capacity: number;
  remaining: number;
}

export interface HotelBookingCandidate {
  id: string;
  title: string;
  city: string;
  priceMinor: string;
  amenities: readonly string[];
  windows: readonly HotelInventoryWindow[];
}

export interface HotelBookingCriteria {
  /** Property-local check-in calendar date. If omitted, each hotel uses its next bookable night. */
  checkInDate?: string;
  /** Property-local check-out calendar date; exclusive. Defaults to one night after check-in. */
  checkOutDate?: string;
  rooms?: number;
  city?: string;
  /** Optional requested amenities. Matching is case-insensitive. */
  amenities?: readonly string[];
  /** Optional maximum base room subtotal in kobo, before tax/discount/fees. */
  maxBaseTotalMinor?: string;
  /** Injectable clock for deterministic tests and auditable search responses. */
  asOf?: string;
}

export interface HotelBookingOptimization {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  roomsRequested: number;
  /** Minimum remaining room capacity across every requested night. */
  roomsAvailable: number;
  /** Base room subtotal only. The final server quote may include approved discounts and taxes. */
  estimatedBaseTotalMinor: string;
  matchScore: number;
  reasons: string[];
  checkedAt: string;
  policyVersion: '7even-hotel-ranking-v1';
}

interface EligibleCandidate {
  hotel: HotelBookingCandidate;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  roomsAvailable: number;
  estimatedBaseTotal: bigint;
  matches: string[];
  cityFit: number;
}

const DAY_MS = 86_400_000;
const POLICY_VERSION = '7even-hotel-ranking-v1' as const;

function calendarDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    throw new RangeError('Hotel dates must use YYYY-MM-DD calendar dates.');
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError('Hotel dates must be real calendar dates.');
  }
  return timestamp;
}

function addDays(value: string, days: number): string {
  return new Date(calendarDate(value) + days * DAY_MS).toISOString().slice(0, 10);
}

function localDateInLagos(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function validMinor(value: string, label: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})$/.test(value)) {
    throw new RangeError(`${label} must be an exact integer amount in kobo.`);
  }
  return BigInt(value);
}

function normalized(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLocaleLowerCase('en-NG')).filter(Boolean))];
}

function hasCapacity(window: HotelInventoryWindow, rooms: number, asOfMs: number): boolean {
  return Number.isSafeInteger(window.remaining)
    && window.remaining >= rooms
    && Number.isSafeInteger(window.capacity)
    && window.capacity >= window.remaining
    && Number.isFinite(Date.parse(window.endAt))
    && Date.parse(window.endAt) > asOfMs;
}

function uniqueAvailableWindow(
  hotel: HotelBookingCandidate,
  date: string,
  rooms: number,
  asOfMs: number,
): HotelInventoryWindow | null {
  const matching = hotel.windows.filter(
    (window) => window.serviceDate === date && hasCapacity(window, rooms, asOfMs),
  );
  // The booking transaction expects one inventory window per hotel/room offer/night.
  return matching.length === 1 ? matching[0]! : null;
}

function cityFit(hotelCity: string, requestedCity: string): number {
  const city = hotelCity.trim().toLocaleLowerCase('en-NG');
  const requested = requestedCity.trim().toLocaleLowerCase('en-NG');
  if (!requested) return 0;
  if (city === requested) return 1;
  return city.includes(requested) ? 0.75 : requested.includes(city) ? 0.5 : 0;
}

/**
 * Rank only hotel offers that can fulfil every requested night from current inventory.
 * It is a deterministic ranking policy, not a trained prediction model and never changes rates.
 */
export function optimizeHotelBookings(
  candidates: readonly HotelBookingCandidate[],
  criteria: HotelBookingCriteria = {},
): HotelBookingOptimization[] {
  const rooms = criteria.rooms ?? 1;
  if (!Number.isSafeInteger(rooms) || rooms < 1 || rooms > 100) {
    throw new RangeError('Rooms must be a whole number between 1 and 100.');
  }

  const now = criteria.asOf === undefined ? new Date() : new Date(criteria.asOf);
  if (!Number.isFinite(now.getTime())) throw new RangeError('The availability-check time is invalid.');
  if (criteria.checkOutDate && !criteria.checkInDate) {
    throw new RangeError('Check-in is required when check-out is provided.');
  }
  if (criteria.checkInDate && criteria.checkInDate < localDateInLagos(now)) {
    throw new RangeError('Check-in cannot be in the past in the hotel time zone.');
  }

  const budget = criteria.maxBaseTotalMinor === undefined
    ? undefined
    : validMinor(criteria.maxBaseTotalMinor, 'Maximum base total');
  const requiredAmenities = normalized(criteria.amenities);
  const requestedCity = criteria.city?.trim() ?? '';
  const asOfMs = now.getTime();
  const today = localDateInLagos(now);
  const selectedDates = criteria.checkInDate
    ? serviceDates(criteria.checkInDate, criteria.checkOutDate ?? addDays(criteria.checkInDate, 1))
    : null;

  const eligible: EligibleCandidate[] = [];

  for (const hotel of candidates) {
    const nightlyPrice = validMinor(hotel.priceMinor, 'Hotel base rate');
    if (nightlyPrice === 0n) continue;

    let dates = selectedDates;
    let checkInDate = criteria.checkInDate;
    let checkOutDate = criteria.checkOutDate;
    let chosenWindows: HotelInventoryWindow[] = [];

    if (!dates) {
      const availableDates = [...new Set(hotel.windows
        .filter((window) => window.serviceDate >= today && hasCapacity(window, rooms, asOfMs))
        .map((window) => window.serviceDate))]
        .sort((a, b) => calendarDate(a) - calendarDate(b));

      let nextDate: string | undefined;
      for (const date of availableDates) {
        const window = uniqueAvailableWindow(hotel, date, rooms, asOfMs);
        if (window) {
          nextDate = date;
          chosenWindows = [window];
          break;
        }
      }
      if (!nextDate) continue;
      checkInDate = nextDate;
      checkOutDate = addDays(nextDate, 1);
      dates = [nextDate];
    } else {
      chosenWindows = dates.map((date) => uniqueAvailableWindow(hotel, date, rooms, asOfMs)).filter(
        (window): window is HotelInventoryWindow => window !== null,
      );
      if (chosenWindows.length !== dates.length) continue;
    }

    const nights = dates.length;
    const roomsAvailable = Math.min(...chosenWindows.map((window) => window.remaining));
    const estimatedBaseTotal = nightlyPrice * BigInt(rooms) * BigInt(nights);
    if (budget !== undefined && estimatedBaseTotal > budget) continue;

    const hotelAmenities = normalized(hotel.amenities);
    const matches = requiredAmenities.filter((amenity) => hotelAmenities.includes(amenity));
    eligible.push({
      hotel,
      checkInDate: checkInDate!,
      checkOutDate: checkOutDate!,
      nights,
      roomsAvailable,
      estimatedBaseTotal,
      matches,
      cityFit: cityFit(hotel.city, requestedCity),
    });
  }

  if (eligible.length === 0) return [];

  const minTotal = eligible.reduce((lowest, candidate) =>
    candidate.estimatedBaseTotal < lowest ? candidate.estimatedBaseTotal : lowest,
    eligible[0]!.estimatedBaseTotal,
  );
  const maxTotal = eligible.reduce((highest, candidate) =>
    candidate.estimatedBaseTotal > highest ? candidate.estimatedBaseTotal : highest,
    eligible[0]!.estimatedBaseTotal,
  );
  const maxRoomsAvailable = Math.max(...eligible.map((candidate) => candidate.roomsAvailable));
  const activeWeight = 45 + 25 + (requestedCity ? 15 : 0) + (requiredAmenities.length ? 15 : 0);

  const ranked = eligible.map((candidate) => {
    const priceFit = maxTotal === minTotal
      ? 1
      : Number((maxTotal - candidate.estimatedBaseTotal) * 1_000_000n / (maxTotal - minTotal)) / 1_000_000;
    const inventoryFit = maxRoomsAvailable > 0 ? candidate.roomsAvailable / maxRoomsAvailable : 0;
    let weightedScore = priceFit * 45 + inventoryFit * 25;
    if (requestedCity) weightedScore += candidate.cityFit * 15;
    if (requiredAmenities.length) weightedScore += (candidate.matches.length / requiredAmenities.length) * 15;
    const matchScore = Math.max(0, Math.min(100, Math.round(weightedScore / activeWeight * 100)));

    const reasons = [
      `Live inventory has ${candidate.roomsAvailable} room(s) available across all ${candidate.nights} requested night(s).`,
      candidate.estimatedBaseTotal === minTotal
        ? 'Lowest base room subtotal among the currently available matches.'
        : 'Ranked against the base room rates of currently available matches.',
    ];
    if (requestedCity) {
      reasons.push(candidate.cityFit === 1
        ? 'Property city matches your location preference.'
        : candidate.cityFit > 0
          ? 'Property is a partial match for your location preference.'
          : 'Property does not exactly match your location preference.');
    }
    if (requiredAmenities.length) {
      reasons.push(`Matches ${candidate.matches.length} of ${requiredAmenities.length} requested amenity(ies).`);
    }
    reasons.push('Estimate excludes taxes, approved discounts and provider fees; the server recalculates the final quote.');
    return {
      id: candidate.hotel.id,
      checkInDate: candidate.checkInDate,
      checkOutDate: candidate.checkOutDate,
      nights: candidate.nights,
      roomsRequested: rooms,
      roomsAvailable: candidate.roomsAvailable,
      estimatedBaseTotalMinor: candidate.estimatedBaseTotal.toString(),
      matchScore,
      reasons,
      checkedAt: now.toISOString(),
      policyVersion: POLICY_VERSION,
      totalForSort: candidate.estimatedBaseTotal,
    };
  });

  ranked.sort((a, b) =>
    b.matchScore - a.matchScore
    || (a.totalForSort < b.totalForSort ? -1 : a.totalForSort > b.totalForSort ? 1 : 0)
    || b.roomsAvailable - a.roomsAvailable
    || a.id.localeCompare(b.id),
  );

  return ranked.map((option) => ({
    id: option.id,
    checkInDate: option.checkInDate,
    checkOutDate: option.checkOutDate,
    nights: option.nights,
    roomsRequested: option.roomsRequested,
    roomsAvailable: option.roomsAvailable,
    estimatedBaseTotalMinor: option.estimatedBaseTotalMinor,
    matchScore: option.matchScore,
    reasons: option.reasons,
    checkedAt: option.checkedAt,
    policyVersion: option.policyVersion,
  }));
}
