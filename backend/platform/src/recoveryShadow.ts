import { decideRevenueAction } from '@7even/engine';
import type { RevenueDecisionInput } from '@7even/engine';

export type PersistedRecoveryEvent =
  | 'SEARCH'
  | 'ROOM_VIEW'
  | 'BOOKING_START'
  | 'CHECKOUT_VIEW'
  | 'ABANDON'
  | 'PAYMENT_FAILED'
  | 'BOOKING_CONFIRMED';

/**
 * Recovery telemetry does not currently carry an authoritative inventory source
 * or confirmation timestamp. Keep inventory UNKNOWN so the engine fails closed.
 * Consent is deliberately false: shadow decisions never authorize outreach.
 */
export function buildRecoveryShadowDecision(
  event: PersistedRecoveryEvent,
  asOf: string,
) {
  const input: RevenueDecisionInput = {
    asOf,
    inventoryObservedAt: null,
    inventorySource: 'UNKNOWN',
    availableUnits: 0,
    expectedDemandUnits: 0,
    guestHasMarketingConsent: false,
    event,
  };
  return decideRevenueAction(input);
}
