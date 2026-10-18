import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { rows, one, transaction } from './db.ts';
import { providerCode, providerFor } from './providerRegistry.ts';
import type { ProviderSource } from './providerRegistry.ts';
import { applyReceipt, reconcile } from './payments.ts';
import { expireHolds } from './reservations.ts';
import { expireTrades } from './benefits.ts';
import { observation, notify, paymentProjection } from './store.ts';

/** Reconstruct only observed local outcomes. Never relaunch an uncertain external effect. */
export async function recoverClaims(pool: Pool): Promise<number> {
  return transaction(pool, async (db) => {
    const claims = await rows(
      db,
      "SELECT * FROM seven.idempotencies WHERE response_body->>'__pending'='true' AND created_at<now()-interval '2 minutes' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 50",
    );
    for (const claim of claims) {
      const checkout = String(claim.operation_name).match(
        /^POST:\/api\/reservations\/([a-f0-9-]+)\/checkout$/,
      );
      const development = String(claim.operation_name).match(
        /^POST:\/api\/payments\/([a-f0-9-]+)\/dev-complete$/,
      );
      const refund = String(claim.operation_name).match(
        /^POST:\/api\/reservations\/([a-f0-9-]+)\/refunds$/,
      );
      let result: unknown;
      if (checkout) {
        const payment = await one(
          db,
          'SELECT * FROM seven.payment_attempts WHERE reservation_id=$1 ORDER BY created_at LIMIT 1',
          [checkout[1]],
        );
        if (payment?.checkout_url)
          result = {
            paymentId: payment.payment_attempt_id,
            reference: payment.merchant_reference,
            checkoutUrl: payment.checkout_url,
            mode: payment.provider_details.mode,
            provider: providerCode(payment.payment_provider_id),
            method: Number(payment.payment_provider_id) === 3 ? 'USDC_BASE' : 'FIAT',
          };
      } else if (development) {
        const payment = await paymentProjection(db, development[1]!);
        if (payment && ['PAID', 'FAILED', 'REVIEW_REQUIRED', 'REFUNDED'].includes(payment.status))
          result = payment;
      } else if (
        claim.operation_name === 'POST:/api/payments/verify' &&
        typeof claim.response_body.__reference === 'string'
      ) {
        const payment = await one(
          db,
          'SELECT payment_attempt_id FROM seven.payment_attempts WHERE merchant_reference=$1',
          [claim.response_body.__reference],
        );
        if (payment) result = await paymentProjection(db, payment.payment_attempt_id);
      } else if (refund) {
        const payment = await one(
          db,
          'SELECT p.payment_attempt_id FROM seven.payment_attempts p JOIN seven.refunds f USING(payment_attempt_id) WHERE p.reservation_id=$1 AND ($2::uuid IS NULL OR p.payment_attempt_id=$2) ORDER BY f.created_at DESC LIMIT 1',
          [refund[1], claim.response_body.__paymentId ?? null],
        );
        if (payment) result = await paymentProjection(db, payment.payment_attempt_id);
      }
      await db.query('UPDATE seven.idempotencies SET response_body=$2 WHERE idempotency_id=$1', [
        claim.idempotency_id,
        result ?? {
          __error: {
            status: 409,
            code: 'INTERRUPTED_OPERATION',
            message:
              'The operation was interrupted. Review the current record before starting a new request; uncertain payments and refunds must be reconciled.',
          },
        },
      ]);
    }
    return claims.length;
  });
}

export async function processInbox(pool: Pool, provider: ProviderSource): Promise<number> {
  const leaseId = randomUUID();
  const events = await transaction(pool, async (db) =>
    rows(
      db,
      `UPDATE seven.provider_events SET lease_id=$1,lease_expires_at=now()+interval '2 minutes',attempts=attempts+1 WHERE provider_event_id IN (SELECT provider_event_id FROM seven.provider_events WHERE processed_at IS NULL AND attempts<5 AND next_attempt_at<=now() AND (lease_expires_at IS NULL OR lease_expires_at<=now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 5) RETURNING *`,
      [leaseId],
    ),
  );
  let processed = 0;
  for (const event of events) {
    try {
      const providerId = providerCode(event.payment_provider_id);
      const payment = await one(
        pool,
        'SELECT payment_provider_id,provider_details FROM seven.payment_attempts WHERE merchant_reference=$1',
        [String(event.details.reference)],
      );
      if (!payment || Number(payment.payment_provider_id) !== Number(event.payment_provider_id))
        throw new Error('Provider does not match the saved attempt.');
      const adapter = providerFor(provider, providerId);
      if (payment.provider_details.mode !== adapter.mode)
        throw new Error('Provider execution mode does not match the attempt.');
      const receipt = await adapter.verify(
        String(event.details.reference),
        String(event.details.id),
      );
      if (receipt.id !== String(event.details.id) || receipt.reference !== event.details.reference)
        throw new Error('Provider reference mismatch.');
      const applied = await transaction(pool, async (db) => {
        const owned = await one(
          db,
          'SELECT provider_event_id FROM seven.provider_events WHERE provider_event_id=$1 AND lease_id=$2 AND lease_expires_at>now() AND processed_at IS NULL FOR UPDATE',
          [event.provider_event_id, leaseId],
        );
        if (!owned) return false;
        await applyReceipt(db, receipt, null, providerId);
        await db.query(
          'UPDATE seven.provider_events SET processed_at=now(),lease_id=NULL,lease_expires_at=NULL,last_error=NULL WHERE provider_event_id=$1',
          [event.provider_event_id],
        );
        return true;
      });
      if (applied) processed++;
    } catch {
      await pool.query(
        "UPDATE seven.provider_events SET lease_id=NULL,lease_expires_at=NULL,next_attempt_at=now()+(LEAST(1800,30*power(2,attempts)) * interval '1 second'),last_error=$3 WHERE provider_event_id=$1 AND lease_id=$2",
        [
          event.provider_event_id,
          leaseId,
          'Provider event verification failed. Bounded reconciliation or operational review required.',
        ],
      );
    }
  }
  return processed;
}

export async function processOutbox(pool: Pool): Promise<number> {
  return transaction(pool, async (db) => {
    const events = await rows(
      db,
      'SELECT * FROM seven.outbox_events WHERE processed_at IS NULL AND attempts<5 AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 50',
    );
    for (const event of events) {
      await db.query('SAVEPOINT outbox_item');
      try {
        if (event.business_id) {
          if (event.event_code === 'payment.verified') {
            const r = await one(
              db,
              'SELECT r.offering_id FROM seven.payment_attempts p JOIN seven.reservations r USING(reservation_id) WHERE p.payment_attempt_id=$1',
              [event.details.resourceId],
            );
            if (r)
              await observation(
                db,
                event.business_id,
                r.offering_id,
                'CONFIRMED',
                `outbox:${event.outbox_event_id}`,
              );
          }
          const venue = await one(
            db,
            'SELECT venue_id FROM seven.offerings WHERE offering_id::varchar=$1 UNION SELECT o.venue_id FROM seven.reservations r JOIN seven.offerings o USING(offering_id) WHERE r.reservation_id::varchar=$1 UNION SELECT o.venue_id FROM seven.payment_attempts p JOIN seven.reservations r USING(reservation_id) JOIN seven.offerings o USING(offering_id) WHERE p.payment_attempt_id::varchar=$1 LIMIT 1',
            [event.details.resourceId],
          );
          const members = await rows(
            db,
            'SELECT m.user_id,r.role_code FROM seven.memberships m JOIN seven.users u USING(user_id) JOIN seven.roles r ON r.role_id=m.role_id WHERE m.business_id=$1 AND m.is_active AND u.is_active AND ($2::uuid IS NULL OR m.user_id<>$2) AND (m.venue_id IS NULL OR m.venue_id=$3)',
            [event.business_id, event.details.actorId ?? null, venue?.venue_id ?? null],
          );
          const text = event.event_code.replaceAll('.', ' ').replaceAll('_', ' ');
          for (const member of members)
            await notify(
              db,
              member.user_id,
              'Business activity',
              `${text.charAt(0).toUpperCase()}${text.slice(1)}. Open your workspace to review the current record.`,
              member.role_code === 'RECEPTION' ? '/reception' : '/business',
            );
        }
        await db.query(
          'UPDATE seven.outbox_events SET processed_at=now(),attempts=attempts+1 WHERE outbox_event_id=$1',
          [event.outbox_event_id],
        );
        await db.query('RELEASE SAVEPOINT outbox_item');
      } catch {
        await db.query('ROLLBACK TO SAVEPOINT outbox_item');
        await db.query(
          "UPDATE seven.outbox_events SET attempts=attempts+1,next_attempt_at=now()+(LEAST(1800,30*power(2,attempts+1))*interval '1 second'),last_error='Notification consumer failed. Review after bounded retries.' WHERE outbox_event_id=$1",
          [event.outbox_event_id],
        );
      }
    }
    return events.length;
  });
}

export async function runRecovery(pool: Pool, provider: ProviderSource): Promise<void> {
  await recoverClaims(pool);
  await transaction(pool, async (db) => {
    await expireHolds(db);
    await expireTrades(db);
  });
  await processInbox(pool, provider);
  await reconcile(pool, provider);
  await processOutbox(pool);
}
