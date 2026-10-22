import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideRevenueAction } from '../src/revenueOrchestration.ts';

const base = {
  asOf: '2026-10-22T01:00:00.000Z',
  inventoryObservedAt: '2026-10-22T00:59:00.000Z',
  inventorySource: 'PMS' as const,
  availableUnits: 4,
  expectedDemandUnits: 1,
  guestHasMarketingConsent: false,
  event: 'SEARCH' as const,
};

describe('bounded revenue orchestration', () => {
  it('requests inventory refresh when snapshot is missing or stale', () => {
    assert.equal(decideRevenueAction({ ...base, inventoryObservedAt: null }).action, 'REQUEST_PMS_REFRESH');
    assert.equal(decideRevenueAction({ ...base, inventoryObservedAt: '2026-10-22T00:00:00.000Z' }).action, 'REQUEST_PMS_REFRESH');
  });
  it('never promotes zero inventory', () => {
    assert.equal(decideRevenueAction({ ...base, availableUnits: 0 }).action, 'HOLD');
  });
  it('requires approval before promoting available inventory', () => {
    const result = decideRevenueAction(base);
    assert.equal(result.action, 'PROMOTE_AVAILABLE_INVENTORY');
    assert.equal(result.requiresHumanApproval, true);
  });
  it('does not contact a guest without marketing consent', () => {
    const result = decideRevenueAction({ ...base, event: 'CHECKOUT_VIEW', totalPriceMinor: 12000, initialRoomPriceMinor: 10000 });
    assert.equal(result.action, 'OFFER_LOWER_COST_ROOM');
    assert.equal(result.mayContactGuest, false);
  });
  it('allows eligible recovery contact only with consent', () => {
    const result = decideRevenueAction({ ...base, guestHasMarketingConsent: true, event: 'ABANDON', totalPriceMinor: 12000, initialRoomPriceMinor: 10000 });
    assert.equal(result.mayContactGuest, true);
  });
  it('routes high-value abandoned leads to human review', () => {
    const result = decideRevenueAction({ ...base, event: 'ABANDON', nights: 4, totalPriceMinor: 100000 });
    assert.equal(result.action, 'ALERT_HUMAN_SALES');
    assert.equal(result.requiresHumanApproval, true);
    assert.equal(result.mayContactGuest, false);
  });
  it('recommends ancillary offers only after booking confirmation', () => {
    assert.equal(decideRevenueAction({ ...base, event: 'BOOKING_CONFIRMED' }).action, 'OFFER_ANCILLARY');
  });
  it('calculates incremental net revenue in minor currency units', () => {
    const result = decideRevenueAction({ ...base, economics: {
      newRevenueMinor: 10000, recoveredRevenueMinor: 2000, upsellRevenueMinor: 1000,
      acquisitionCostMinor: 500, commissionMinor: 1000, discountMinor: 300, cancellationLossMinor: 200,
    }});
    assert.equal(result.incrementalNetRevenueMinor, 11000);
  });
  it('rejects future observations and negative economics', () => {
    assert.throws(() => decideRevenueAction({ ...base, inventoryObservedAt: '2026-10-22T02:00:00.000Z' }));
    assert.throws(() => decideRevenueAction({ ...base, economics: {
      newRevenueMinor: -1, recoveredRevenueMinor: 0, upsellRevenueMinor: 0,
      acquisitionCostMinor: 0, commissionMinor: 0, discountMinor: 0, cancellationLossMinor: 0,
    }}));
  });
});
