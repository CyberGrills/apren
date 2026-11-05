import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRecoveryShadowDecision } from '../../backend/platform/src/recoveryShadow.ts';

describe('booking recovery shadow decisions', () => {
  const asOf = '2026-11-02T05:00:00.000Z';

  it('routes payment failures to human reconciliation regardless of inventory freshness', () => {
    const result = buildRecoveryShadowDecision('PAYMENT_FAILED', asOf);
    assert.equal(result.action, 'REVIEW_PAYMENT_ISSUE');
    assert.equal(result.requiresHumanApproval, true);
    assert.equal(result.mayContactGuest, false);
  });

  it('fails closed for funnel events when authoritative inventory provenance is absent', () => {
    for (const event of ['SEARCH', 'ROOM_VIEW', 'BOOKING_START', 'CHECKOUT_VIEW', 'ABANDON'] as const) {
      const result = buildRecoveryShadowDecision(event, asOf);
      assert.equal(result.action, 'REQUEST_PMS_REFRESH', event);
      assert.equal(result.mayContactGuest, false, event);
      assert.equal(result.evidence.inventorySource, 'UNKNOWN', event);
      assert.equal(result.evidence.inventoryAgeSeconds, null, event);
    }
  });

  it('does not authorize contact even when a future caller supplies consent elsewhere', () => {
    const result = buildRecoveryShadowDecision('ABANDON', asOf);
    assert.equal(result.mayContactGuest, false);
  });

  it('supports confirmed events from the persisted schema without creating an outbound action', () => {
    const result = buildRecoveryShadowDecision('BOOKING_CONFIRMED', asOf);
    assert.equal(result.action, 'REQUEST_PMS_REFRESH');
    assert.equal(result.mayContactGuest, false);
  });
});
