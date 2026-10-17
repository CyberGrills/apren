import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessDemand } from '../src/demand.ts';
import type { DemandInput } from '../src/demand.ts';

const observed: DemandInput = {
  searches: 100, quotes: 40, confirmed: 20, cancelled: 2, fulfilled: 12,
  capacity: 10, allocated: 7, asOf: '2026-10-16T12:00:00.000Z',
  periodStart: '2026-10-09T12:00:00.000Z', goal: 'BALANCED',
};

describe('demand evidence and bounded rules', () => {
  it('preserves counts, source period and policy version', () => {
    const result = assessDemand(observed);
    assert.equal(result.status, 'READY');
    assert.equal(result.evidence.searches, 100);
    assert.equal(result.evidence.observations, 174);
    assert.equal(result.evidence.occupancyBps, 7000);
    assert.equal(result.evidence.conversionBps, 2000);
    assert.deepEqual(result.period, { start: observed.periodStart, end: observed.asOf });
    assert.equal(result.policyVersion, 'demand-rules-v1');
    assert.equal('confidence' in result, false);
  });
  it('uses an explicit occupancy goal to promote remaining capacity', () => assert.equal(assessDemand({ ...observed, goal: 'OCCUPANCY' }).recommendations[0]?.action, 'PROMOTE_AVAILABLE_CAPACITY'));
  it('uses an explicit revenue goal to review rates on strong demand', () => assert.equal(assessDemand({ ...observed, goal: 'REVENUE' }).recommendations[0]?.action, 'REVIEW_RATE'));
  it('keeps balanced moderate occupancy stable', () => assert.equal(assessDemand(observed).recommendations[0]?.action, 'KEEP_CURRENT_PLAN'));
  it('makes commercial suggestions require approval', () => assert.equal(assessDemand({ ...observed, goal: 'REVENUE' }).recommendations[0]?.requiresApproval, true));
  it('does not invent a source start when none was supplied', () => assert.equal(assessDemand({ ...observed, periodStart: undefined }).period.start, null));
  it('does not promote capacity that is completely allocated', () => assert.equal(assessDemand({ ...observed, allocated: 10, goal: 'OCCUPANCY' }).recommendations[0]?.action, 'KEEP_CURRENT_PLAN'));
  it('reviews material cancellations before promoting demand', () => assert.equal(assessDemand({ ...observed, cancelled: 10 }).recommendations[0]?.action, 'REVIEW_CANCELLATIONS'));
  it('reviews the booking flow for weak revenue signals', () => assert.equal(assessDemand({ ...observed, confirmed: 1, allocated: 1, goal: 'REVENUE' }).recommendations[0]?.action, 'REVIEW_BOOKING_FLOW'));
  it('promotes low balanced occupancy', () => assert.equal(assessDemand({ ...observed, allocated: 2 }).recommendations[0]?.action, 'PROMOTE_AVAILABLE_CAPACITY'));
  it('reviews a constrained high-demand balanced rate', () => assert.equal(assessDemand({ ...observed, allocated: 9 }).recommendations[0]?.action, 'REVIEW_RATE'));
  it('reports no-event evidence as insufficient', () => {
    const result = assessDemand({ ...observed, searches: 0, quotes: 0, confirmed: 0, cancelled: 0, fulfilled: 0 });
    assert.equal(result.status, 'INSUFFICIENT_DATA');
    assert.deepEqual(result.recommendations, []);
    assert.equal(result.evidence.conversionBps, null);
  });
  it('honors a stricter minimum number of recorded events', () => assert.equal(assessDemand({ ...observed, minSamples: 200 }).status, 'INSUFFICIENT_DATA'));
  it('reports absent capacity instead of fabricating occupancy', () => {
    const result = assessDemand({ ...observed, capacity: 0, allocated: 0 });
    assert.equal(result.status, 'INSUFFICIENT_DATA');
    assert.equal(result.evidence.occupancyBps, null);
  });
  it('does not mutate source counts', () => {
    const input = Object.freeze({ ...observed });
    assessDemand(input);
    assert.deepEqual(input, observed);
  });
  for (const key of ['searches', 'quotes', 'confirmed', 'cancelled', 'fulfilled', 'capacity', 'allocated'] as const) {
    it(`rejects a negative ${key}`, () => assert.throws(() => assessDemand({ ...observed, [key]: -1 })));
    it(`rejects a fractional ${key}`, () => assert.throws(() => assessDemand({ ...observed, [key]: 0.5 })));
    it(`rejects an unsafe ${key}`, () => assert.throws(() => assessDemand({ ...observed, [key]: Number.MAX_SAFE_INTEGER + 1 })));
  }
  it('rejects allocated capacity exceeding total capacity', () => assert.throws(() => assessDemand({ ...observed, allocated: 11 })));
  it('rejects an unrecognized goal', () => assert.throws(() => assessDemand({ ...observed, goal: 'MAGIC' as DemandInput['goal'] })));
  it('rejects a zero sample threshold', () => assert.throws(() => assessDemand({ ...observed, minSamples: 0 })));
  it('rejects an invalid observation timestamp', () => assert.throws(() => assessDemand({ ...observed, asOf: 'not a date' })));
  it('rejects a normalized but nonexistent observation date', () => assert.throws(() => assessDemand({ ...observed, asOf: '2026-02-30T12:00:00.000Z' })));
  it('rejects a source period starting after its end', () => assert.throws(() => assessDemand({ ...observed, periodStart: '2027-01-01T00:00:00.000Z' })));
});
