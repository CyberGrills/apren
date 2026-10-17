export const MAX_STAY_NIGHTS = 366;
const DAY_MS = 86_400_000;

function calendarDate(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    throw new RangeError('Service dates must use a valid YYYY-MM-DD calendar date.');
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError('Service dates must be real calendar dates.');
  }
  return timestamp;
}

/** Calendar service nights, independent of the venue's UTC offset or daylight saving. */
export function serviceDates(startDate: string, endDate: string): string[] {
  const start = calendarDate(startDate);
  const nights = (calendarDate(endDate) - start) / DAY_MS;
  if (nights < 1 || nights > MAX_STAY_NIGHTS) {
    throw new RangeError(`A stay must contain between 1 and ${MAX_STAY_NIGHTS} nights.`);
  }
  return Array.from({ length: nights }, (_, day) => new Date(start + day * DAY_MS).toISOString().slice(0, 10));
}

export type ReservationState = 'HELD' | 'CONFIRMED' | 'CHECKED_IN' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED' | 'PAYMENT_REVIEW';
export type ReservationAction = 'PAYMENT_VERIFIED' | 'CHECK_IN' | 'FULFILL' | 'CANCEL' | 'EXPIRE';

const transitions: Readonly<Record<ReservationState, readonly ReservationAction[]>> = {
  HELD: ['PAYMENT_VERIFIED', 'CANCEL', 'EXPIRE'],
  CONFIRMED: ['CHECK_IN', 'FULFILL', 'CANCEL'],
  CHECKED_IN: ['FULFILL'],
  FULFILLED: [], CANCELLED: [], EXPIRED: [], PAYMENT_REVIEW: [],
};

/** Checks policy only. The caller still verifies payment, authority, expiry and DB revision. */
export function allowedTransition(current: string, action: string): boolean {
  if (!Object.hasOwn(transitions, current)) return false;
  return transitions[current as ReservationState].includes(action as ReservationAction);
}
