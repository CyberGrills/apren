/**
 * Provider-neutral boundary for 7even's PMS/channel-manager inventory integration.
 * No vendor is assumed: Kiniz's provider, authorization, credentials and property
 * mapping remain unconfirmed. Snapshots are observation-only, never bookable by default.
 */
export type PmsProvider = 'cloudbeds' | 'siteminder' | 'staah' | 'other' | 'unconfirmed';
export type PmsAdapterErrorCode =
  | 'PMS_PROVIDER_UNCONFIRMED'
  | 'PMS_AUTHORIZATION_REQUIRED'
  | 'PMS_CREDENTIALS_NOT_CONFIGURED'
  | 'PMS_PROPERTY_MAPPING_REQUIRED'
  | 'PMS_ADAPTER_NOT_IMPLEMENTED'
  | 'PMS_READ_ONLY_VIOLATION'
  | 'PMS_INVALID_SNAPSHOT';

export class PmsAdapterError extends Error {
  readonly code: PmsAdapterErrorCode;
  constructor(code: PmsAdapterErrorCode, message: string) {
    super(message);
    this.name = 'PmsAdapterError';
    this.code = code;
  }
}

export interface PmsConnectionReadiness {
  provider: PmsProvider;
  partnerAuthorizationConfirmed: boolean;
  apiAccessApproved: boolean;
  credentialsConfigured: boolean;
  externalPropertyId?: string;
}
export interface PmsRoomType {
  externalRoomTypeId: string;
  name: string;
  maxOccupancy: number;
}
export interface PmsRatePlan {
  externalRatePlanId: string;
  roomTypeId: string;
  name: string;
  currency: string;
  amountMinor: number;
  refundable: boolean | null;
  cancellationPolicyText: string | null;
}
export interface PmsNightInventory {
  roomTypeId: string;
  ratePlanId: string;
  date: string;
  availableRooms: number;
  amountMinor: number;
  currency: string;
  restrictions: {
    closedToArrival: boolean | null;
    closedToDeparture: boolean | null;
    minimumStayNights: number | null;
    maximumStayNights: number | null;
  };
}
export interface PmsReadSnapshot {
  provider: Exclude<PmsProvider, 'unconfirmed'>;
  externalPropertyId: string;
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  roomTypes: PmsRoomType[];
  ratePlans: PmsRatePlan[];
  nightlyInventory: PmsNightInventory[];
  mode: 'OBSERVATION_ONLY';
}
export interface ReadOnlyPmsAdapter {
  readonly provider: Exclude<PmsProvider, 'unconfirmed'>;
  readSnapshot(input: {
    externalPropertyId: string;
    checkIn: string;
    checkOut: string;
  }): Promise<PmsReadSnapshot>;
}

/** Fail closed until provider, written authorization, API access, credentials and property mapping are verified. */
export function assertPmsConnectionReady(
  readiness: PmsConnectionReadiness,
): asserts readiness is PmsConnectionReadiness & {
  provider: Exclude<PmsProvider, 'unconfirmed'>;
  externalPropertyId: string;
} {
  if (readiness.provider === 'unconfirmed') {
    throw new PmsAdapterError('PMS_PROVIDER_UNCONFIRMED', 'Confirm the PMS/channel manager with the hotel before selecting a vendor adapter.');
  }
  if (!readiness.partnerAuthorizationConfirmed || !readiness.apiAccessApproved) {
    throw new PmsAdapterError('PMS_AUTHORIZATION_REQUIRED', 'Written partner authorization and approved API access are required before connecting.');
  }
  if (!readiness.credentialsConfigured) {
    throw new PmsAdapterError('PMS_CREDENTIALS_NOT_CONFIGURED', 'Authorized server-side credentials have not been configured.');
  }
  if (!readiness.externalPropertyId?.trim()) {
    throw new PmsAdapterError('PMS_PROPERTY_MAPPING_REQUIRED', 'Map Kiniz to its verified external PMS property identifier.');
  }
}

/** Defense-in-depth guard for vendor transports. Only read-only GET is allowed. */
export function assertReadOnlyMethod(method: string): void {
  if (method.toUpperCase() !== 'GET') {
    throw new PmsAdapterError('PMS_READ_ONLY_VIOLATION', 'PMS integration is read-only: only GET requests are permitted.');
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Require an explicit timezone so vendor timestamps cannot be interpreted in a server-local timezone. */
function validTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/.test(value)) return false;
  return validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

/** Validate normalized vendor data without filling missing rates or availability with guesses. */
export function validatePmsSnapshot(snapshot: PmsReadSnapshot): PmsReadSnapshot {
  if (!snapshot.externalPropertyId.trim() || snapshot.mode !== 'OBSERVATION_ONLY') {
    throw new PmsAdapterError('PMS_INVALID_SNAPSHOT', 'Snapshot must identify a property and remain observation-only.');
  }
  const fetchedAtMs = Date.parse(snapshot.fetchedAt);
  if (!validTimestamp(snapshot.fetchedAt) ||
      (snapshot.sourceUpdatedAt !== null &&
        (!validTimestamp(snapshot.sourceUpdatedAt) || Date.parse(snapshot.sourceUpdatedAt) > fetchedAtMs))) {
    throw new PmsAdapterError('PMS_INVALID_SNAPSHOT', 'Snapshot timestamps must be zoned ISO timestamps and source data cannot postdate the fetch.');
  }
  const roomIds = new Set<string>();
  for (const room of snapshot.roomTypes) {
    if (!room.externalRoomTypeId.trim() || !room.name.trim() ||
        !Number.isSafeInteger(room.maxOccupancy) || room.maxOccupancy < 1 ||
        roomIds.has(room.externalRoomTypeId)) {
      throw new PmsAdapterError('PMS_INVALID_SNAPSHOT', 'Room type data is invalid or duplicated.');
    }
    roomIds.add(room.externalRoomTypeId);
  }
  const ratePlansById = new Map<string, PmsRatePlan>();
  for (const rate of snapshot.ratePlans) {
    if (!rate.externalRatePlanId.trim() || !roomIds.has(rate.roomTypeId) ||
        !Number.isSafeInteger(rate.amountMinor) || rate.amountMinor < 0 ||
        !/^[A-Z]{3}$/.test(rate.currency) || ratePlansById.has(rate.externalRatePlanId)) {
      throw new PmsAdapterError('PMS_INVALID_SNAPSHOT', 'Rate plan data is invalid or duplicated.');
    }
    ratePlansById.set(rate.externalRatePlanId, rate);
  }
  const inventoryKeys = new Set<string>();
  for (const night of snapshot.nightlyInventory) {
    const key = [night.roomTypeId, night.ratePlanId, night.date].join('|');
    const ratePlan = ratePlansById.get(night.ratePlanId);
    const restrictions = night.restrictions;
    const min = restrictions?.minimumStayNights;
    const max = restrictions?.maximumStayNights;
    if (!roomIds.has(night.roomTypeId) || !ratePlan ||
        ratePlan.roomTypeId !== night.roomTypeId || ratePlan.currency !== night.currency ||
        !validDate(night.date) || !Number.isSafeInteger(night.availableRooms) ||
        night.availableRooms < 0 || !Number.isSafeInteger(night.amountMinor) ||
        night.amountMinor < 0 || !/^[A-Z]{3}$/.test(night.currency) ||
        inventoryKeys.has(key) || !restrictions ||
        (restrictions.closedToArrival !== null && typeof restrictions.closedToArrival !== 'boolean') ||
        (restrictions.closedToDeparture !== null && typeof restrictions.closedToDeparture !== 'boolean') ||
        (min !== null && (!Number.isSafeInteger(min) || min < 1)) ||
        (max !== null && (!Number.isSafeInteger(max) || max < 1)) ||
        (min !== null && max !== null && min > max)) {
      throw new PmsAdapterError('PMS_INVALID_SNAPSHOT', 'Nightly inventory is invalid, duplicated, or inconsistent with its room/rate plan or stay restrictions.');
    }
    inventoryKeys.add(key);
  }
  return snapshot;
}

export type InventoryFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';
/** Missing, invalid, future-dated or over-age source timestamps are never considered fresh. */
export function inventoryFreshness(
  sourceUpdatedAt: string | null,
  now = Date.now(),
  maxAgeMs = 15 * 60 * 1000,
): InventoryFreshness {
  if (sourceUpdatedAt === null) return 'UNKNOWN';
  const timestamp = Date.parse(sourceUpdatedAt);
  if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp > maxAgeMs) return 'STALE';
  return 'FRESH';
}

/** No provider is assumed. This factory deliberately refuses to imply a live connection exists. */
export function createReadOnlyPmsAdapter(readiness: PmsConnectionReadiness): ReadOnlyPmsAdapter {
  assertPmsConnectionReady(readiness);
  throw new PmsAdapterError(
    'PMS_ADAPTER_NOT_IMPLEMENTED',
    'Provider "' + readiness.provider + '" is confirmed, but its vendor-specific read-only adapter has not been implemented.',
  );
}
