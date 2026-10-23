import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookingRecoveryEventSchema } from '../../services/platform/src/bookingRecovery.ts';

const valid = {
  eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  offeringId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  event: 'CHECKOUT_VIEW' as const,
  occurredAt: '2026-10-23T12:00:00.000Z',
};

describe('booking recovery event contract', () => {
  it('accepts pseudonymous checkout events and exact minor-unit strings', () => {
    assert.equal(bookingRecoveryEventSchema.parse({ ...valid, amountMinor: '125000' }).amountMinor, '125000');
    assert.equal(bookingRecoveryEventSchema.parse({ ...valid, amountMinor: '0' }).amountMinor, '0');
  });

  it('rejects malformed or unsafe monetary values', () => {
    for (const amountMinor of ['-1', '01', '1.50', '1e3', '1000000000000000', 'abc']) {
      assert.equal(bookingRecoveryEventSchema.safeParse({ ...valid, amountMinor }).success, false);
    }
  });

  it('does not accept client-asserted booking confirmations or cancellations', () => {
    assert.equal(bookingRecoveryEventSchema.safeParse({ ...valid, event: 'BOOKING_CONFIRMED' }).success, false);
    assert.equal(bookingRecoveryEventSchema.safeParse({ ...valid, event: 'CANCELLED' }).success, false);
  });

  it('requires explicit channel and consent version before recording contact permission', () => {
    assert.equal(bookingRecoveryEventSchema.safeParse({
      ...valid, contactConsent: true, contactChannel: 'WHATSAPP', consentTextVersion: 'v1',
    }).success, true);
    assert.equal(bookingRecoveryEventSchema.safeParse({
      ...valid, contactConsent: true, contactChannel: 'NONE', consentTextVersion: 'v1',
    }).success, false);
    assert.equal(bookingRecoveryEventSchema.safeParse({
      ...valid, contactConsent: false, contactChannel: 'EMAIL',
    }).success, false);
  });
});
