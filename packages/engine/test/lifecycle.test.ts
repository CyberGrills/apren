import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allowedTransition, serviceDates } from '../src/lifecycle.ts';

describe('room service dates', () => {
  it('allocates the arrival date and excludes departure', () => assert.deepEqual(serviceDates('2026-10-16', '2026-10-18'), ['2026-10-16', '2026-10-17']));
  it('does not overlap adjacent bookings', () => assert.deepEqual(serviceDates('2026-10-18', '2026-10-19'), ['2026-10-18']));
  it('includes a valid leap night', () => assert.deepEqual(serviceDates('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29']));
  it('crosses the year boundary', () => assert.deepEqual(serviceDates('2026-12-31', '2027-01-02'), ['2026-12-31', '2027-01-01']));
  it('allows exactly 366 calendar nights', () => assert.equal(serviceDates('2028-01-01', '2029-01-01').length, 366));
  it('rejects a stay longer than the supported limit', () => assert.throws(() => serviceDates('2028-01-01', '2029-01-02')));
  it('rejects a same-day empty stay', () => assert.throws(() => serviceDates('2026-10-16', '2026-10-16')));
  it('rejects reversed dates', () => assert.throws(() => serviceDates('2026-10-17', '2026-10-16')));
  for (const date of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-1-01', '0000-01-01', '2026-01-01T00:00:00Z', 'not a date']) {
    it(`rejects invalid arrival ${date}`, () => assert.throws(() => serviceDates(date, '2029-01-01')));
  }
  it('validates the departure date too', () => assert.throws(() => serviceDates('2026-01-01', '2026-02-30')));
  it('does not depend on the current clock', () => assert.deepEqual(serviceDates('2000-01-01', '2000-01-02'), ['2000-01-01']));
});

describe('reservation transition permissions', () => {
  for (const [current, action] of [
    ['HELD', 'PAYMENT_VERIFIED'], ['CONFIRMED', 'CHECK_IN'], ['CONFIRMED', 'FULFILL'],
    ['CHECKED_IN', 'FULFILL'], ['HELD', 'CANCEL'], ['CONFIRMED', 'CANCEL'], ['HELD', 'EXPIRE'],
  ]) {
    it(`allows ${current} through ${action}`, () => assert.equal(allowedTransition(current!, action!), true));
  }
  for (const [current, action] of [
    ['EXPIRED', 'PAYMENT_VERIFIED'], ['CANCELLED', 'PAYMENT_VERIFIED'], ['FULFILLED', 'FULFILL'],
    ['HELD', 'FULFILL'], ['HELD', 'CHECK_IN'], ['CONFIRMED', 'EXPIRE'], ['CHECKED_IN', 'CANCEL'],
    ['UNKNOWN', 'CANCEL'], ['HELD', 'CONFIRM'], ['HELD', 'toString'], ['PAYMENT_REVIEW', 'PAYMENT_VERIFIED'],
  ]) {
    it(`rejects ${current} through ${action}`, () => assert.equal(allowedTransition(current!, action!), false));
  }
});
