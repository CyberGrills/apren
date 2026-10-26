import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Pool } from 'pg';
import { rateLimitBookingRecoveryEvent } from '../../services/platform/src/accounts.ts';
import { ApiError } from '../../services/platform/src/db.ts';
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
  it('limits public recovery events to 120 requests per IP per shared 15-minute window', async () => {
    let requestCount = 0;
    const pool = {
      query: async (sql: string) => {
        assert.match(sql, /seven\\.account_rate_limits/);
        requestCount += 1;
        return { rows: [{ request_count: requestCount }] };
      },
    } as unknown as Pool;

    for (let i = 0; i < 120; i += 1) await rateLimitBookingRecoveryEvent(pool, '203.0.113.20');
    await assert.rejects(
      () => rateLimitBookingRecoveryEvent(pool, '203.0.113.20'),
      (error: unknown) => error instanceof ApiError && error.status === 429 && error.code === 'RATE_LIMITED',
    );
    assert.equal(requestCount, 121);
  });
});
