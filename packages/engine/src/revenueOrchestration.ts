export type RevenueAction =
  | 'HOLD'
  | 'REQUEST_PMS_REFRESH'
  | 'PROMOTE_AVAILABLE_INVENTORY'
  | 'OFFER_LOWER_COST_ROOM'
  | 'ALERT_HUMAN_SALES'
  | 'OFFER_ANCILLARY';

export interface RevenueEconomics {
  newRevenueMinor: number;
  recoveredRevenueMinor: number;
  upsellRevenueMinor: number;
  acquisitionCostMinor: number;
  commissionMinor: number;
  discountMinor: number;
  cancellationLossMinor: number;
}

export interface RevenueDecisionInput {
  asOf: string;
  inventoryObservedAt: string | null;
  inventorySource: 'PMS' | 'CHANNEL_MANAGER' | 'PARTNER' | 'UNKNOWN';
  availableUnits: number;
  expectedDemandUnits: number;
  guestHasMarketingConsent: boolean;
  event: 'SEARCH' | 'ROOM_VIEW' | 'BOOKING_START' | 'CHECKOUT_VIEW' | 'ABANDON' | 'BOOKING_CONFIRMED';
  totalPriceMinor?: number;
  initialRoomPriceMinor?: number;
  nights?: number;
  rooms?: number;
  isSuite?: boolean;
  economics?: RevenueEconomics;
}

export interface RevenueDecision {
  action: RevenueAction;
  requiresHumanApproval: boolean;
  mayContactGuest: boolean;
  netRevenueContributionMinor: number | null;
  evidence: {
    inventorySource: RevenueDecisionInput['inventorySource'];
    inventoryAgeSeconds: number | null;
    availableUnits: number;
    expectedDemandUnits: number;
    reason: string;
  };
  policyVersion: 'revenue-orchestration-v1';
}

function utcTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
    throw new RangeError('Revenue timestamps must be ISO UTC timestamps.');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new RangeError('Revenue timestamp is invalid.');
  return parsed;
}

function nonNegativeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(name + ' must be a non-negative safe integer.');
  }
}

/** Deterministic revenue triage; it never writes inventory, changes rates or contacts guests. */
export function decideRevenueAction(input: RevenueDecisionInput): RevenueDecision {
  const now = utcTime(input.asOf);
  const observed = input.inventoryObservedAt === null ? null : utcTime(input.inventoryObservedAt);
  if (observed !== null && observed > now) throw new RangeError('Inventory observation cannot be in the future.');
  nonNegativeInteger('availableUnits', input.availableUnits);
  nonNegativeInteger('expectedDemandUnits', input.expectedDemandUnits);
  if (input.totalPriceMinor !== undefined) nonNegativeInteger('totalPriceMinor', input.totalPriceMinor);
  if (input.initialRoomPriceMinor !== undefined) nonNegativeInteger('initialRoomPriceMinor', input.initialRoomPriceMinor);
  if (input.nights !== undefined) nonNegativeInteger('nights', input.nights);
  if (input.rooms !== undefined) nonNegativeInteger('rooms', input.rooms);

  let net: number | null = null;
  if (input.economics) {
    for (const [key, value] of Object.entries(input.economics)) nonNegativeInteger(key, value);
    const e = input.economics;
    const gross = BigInt(e.newRevenueMinor) + BigInt(e.recoveredRevenueMinor) + BigInt(e.upsellRevenueMinor);
    const costs = BigInt(e.acquisitionCostMinor) + BigInt(e.commissionMinor) + BigInt(e.discountMinor) + BigInt(e.cancellationLossMinor);
    const result = gross - costs;
    if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError('Net revenue exceeds the safe integer range.');
    }
    net = Number(result);
  }

  const age = observed === null ? null : Math.floor((now - observed) / 1000);
  const maxAge = input.inventorySource === 'PMS' ? 300 : 120;
  const fresh = age !== null && age <= maxAge && input.inventorySource !== 'UNKNOWN';
  let action: RevenueAction = 'HOLD';
  let requiresHumanApproval = false;
  let mayContactGuest = false;
  let reason = 'No measured signal justifies a change; keep the current offer.';

  if (!fresh) {
    action = 'REQUEST_PMS_REFRESH';
    reason = 'Inventory is missing, stale or from an unknown source. Refresh the authoritative inventory before quoting or campaigning.';
  } else if (input.availableUnits === 0) {
    reason = 'No available units were reported. Do not promote or promise inventory.';
  } else if (input.event === 'ABANDON' || input.event === 'CHECKOUT_VIEW') {
    if ((input.nights ?? 0) >= 3 || (input.rooms ?? 0) >= 2 || input.isSuite === true) {
      action = 'ALERT_HUMAN_SALES';
      requiresHumanApproval = true;
      reason = 'High-value intent detected. Have hotel sales review a tailored proposal; do not auto-discount.';
    } else if (
      input.totalPriceMinor !== undefined &&
      input.initialRoomPriceMinor !== undefined &&
      input.initialRoomPriceMinor > 0 &&
      BigInt(input.totalPriceMinor) * 100n > BigInt(input.initialRoomPriceMinor) * 115n
    ) {
      action = 'OFFER_LOWER_COST_ROOM';
      mayContactGuest = input.guestHasMarketingConsent;
      reason = 'Displayed total is more than 15% above the initial room price. Prefer a comparable lower-cost room before discounting the same room.';
    } else {
      reason = 'Checkout friction is observed but its cause is unconfirmed. Avoid an unsubstantiated discount.';
    }
  } else if (input.event === 'SEARCH' || input.event === 'ROOM_VIEW' || input.event === 'BOOKING_START') {
    if (input.availableUnits > input.expectedDemandUnits) {
      action = 'PROMOTE_AVAILABLE_INVENTORY';
      requiresHumanApproval = true;
      reason = 'Reported capacity exceeds measured expected demand. Recommend a bounded campaign; commercial terms require approval.';
    }
  } else if (input.event === 'BOOKING_CONFIRMED') {
    action = 'OFFER_ANCILLARY';
    reason = 'Booking is confirmed. Recommend relevant optional add-ons without making them a condition of the reservation.';
  }

  return {
    action,
    requiresHumanApproval,
    mayContactGuest,
    netRevenueContributionMinor: net,
    evidence: {
      inventorySource: input.inventorySource,
      inventoryAgeSeconds: age,
      availableUnits: input.availableUnits,
      expectedDemandUnits: input.expectedDemandUnits,
      reason,
    },
    policyVersion: 'revenue-orchestration-v1',
  };
}
