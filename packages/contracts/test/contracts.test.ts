import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteInput, registerInput, offeringInput, receptionEventInput } from '../src/index.ts';

test('customer registration cannot assign administrator authority', () => {
  assert.equal(registerInput.safeParse({ email: 'guest@example.test', password: 'LongEnough123!', displayName: 'Guest', role: 'ADMIN' }).success, false);
});

test('quotes reject a negative quantity', () => {
  assert.equal(quoteInput.safeParse({ offeringId: 'd47fb716-aeee-4020-bd5e-10c6450737a2', startDate: '2026-11-10', quantity: -1 }).success, false);
});

test('offering money must be exact integer minor units', () => {
  const result = offeringInput.safeParse({ title: 'A good room', description: 'A room with a private bathroom and a quiet courtyard.', kind: 'STAY', city: 'Lagos', address: 'Victoria Island', priceMinor: '10.01', capacity: 3 });
  assert.equal(result.success, false);
});

test('reception events require a stable source and event identity', () => {
  assert.equal(receptionEventInput.safeParse({ events: [{ action: 'CHECK_IN' }] }).success, false);
});
