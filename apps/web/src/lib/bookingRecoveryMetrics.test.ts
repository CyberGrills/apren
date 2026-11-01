import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookingRecoveryMetrics } from './bookingRecoveryMetrics.ts';

describe('booking recovery dashboard metrics', () => {
  it('surfaces server-verified bookings after abandonment without claiming causality', () => {
    const metrics = bookingRecoveryMetrics({
      abandoned_sessions: 12,
      consented_abandons: 5,
      confirmed_after_abandon: 2,
      unresolved_abandons: 10,
    });

    assert.deepEqual(metrics.map(({ label, value }) => [label, value]), [
      ['Abandoned sessions', 12],
      ['Consent recorded', 5],
      ['Bookings confirmed after abandonment', 2],
      ['Unresolved sessions', 10],
    ]);
    assert.match(metrics[2]!.note, /not causal uplift/i);
    assert.match(metrics[2]!.note, /cancellations\/refunds are separate/i);
  });

  it('preserves zero counts for a new hotel with no recovery activity', () => {
    const metrics = bookingRecoveryMetrics({
      abandoned_sessions: 0,
      consented_abandons: 0,
      confirmed_after_abandon: 0,
      unresolved_abandons: 0,
    });

    assert.ok(metrics.every((metric) => metric.value === 0));
  });
});
