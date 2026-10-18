import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type { AdminOverview } from '@7even/contracts';
import { createApp } from '../../services/platform/src/app.ts';
import { createPool, one, rows, transaction } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import {
  checkout,
  reconcile,
  requestRefund,
  verifyPayment,
} from '../../services/platform/src/payments.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import type { ProviderRefund } from '../../services/platform/src/provider.ts';
import {
  actOnReservation,
  createQuote,
  createReservation,
} from '../../services/platform/src/reservations.ts';
import { seed } from '../../services/platform/src/seed.ts';
import {
  paymentProjection,
  reservationProjection,
  userProjection,
} from '../../services/platform/src/store.ts';

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('The deferred provider result has not been initialized.');
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('concurrent refund observations preserve delivered accounting and flag contradictions', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 90000,
}, async (t) => {
  const ownerUrl = process.env.TEST_DATABASE_URL;
  assert.ok(ownerUrl);
  const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL ?? ownerUrl;
  const target = (value: string) => {
    const url = new URL(value);
    return {
      hostname: url.hostname,
      port: url.port || '5432',
      pathname: url.pathname,
      socket: url.searchParams.get('host') ?? '',
      queryPort: url.searchParams.get('port') ?? '',
      database: url.searchParams.get('database') ?? '',
      dbname: url.searchParams.get('dbname') ?? '',
    };
  };
  assert.deepEqual(target(ownerUrl), target(runtimeUrl));
  const pool = createPool(ownerUrl);
  const appPool = runtimeUrl === ownerUrl ? pool : createPool(runtimeUrl);
  let server: Server | undefined;
  try {
    const identity =
      'SELECT current_database() AS name,inet_server_addr()::text AS address,inet_server_port() AS port';
    const owner = await one(pool, identity);
    assert.match(String(owner?.name), /_test_db$/, 'Only an isolated test database may be reset.');
    assert.deepEqual(await one(appPool, identity), owner);
    await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
    await migrate(pool);
    await seed(pool, 'Refund-observation-fixture-only-42!');
    const origin = 'http://localhost:5177';
    const runtime = createApp({
      pool: appPool,
      provider: new MockProvider(),
      environment: 'test',
      publicOrigin: origin,
    });
    server = await new Promise<Server>((resolve) => {
      const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@seven.test',
        password: 'Refund-observation-fixture-only-42!',
      }),
    });
    assert.equal(login.status, 200);
    await login.json();
    const adminCookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(adminCookie);
    const guestRow = await one(
      pool,
      "SELECT user_id FROM seven.users WHERE email='guest@seven.test'",
    );
    const adminRow = await one(
      pool,
      "SELECT user_id FROM seven.users WHERE email='admin@seven.test'",
    );
    assert.ok(guestRow && adminRow);
    const guest = await userProjection(appPool, guestRow.user_id);
    const admin = await userProjection(appPool, adminRow.user_id);
    assert.ok(guest && admin);
    const inventory = await one(
      pool,
      `SELECT o.offering_id,w.inventory_window_id,
      to_char(w.starts_at AT TIME ZONE 'Africa/Lagos','YYYY-MM-DD') AS service_date
      FROM seven.offerings o JOIN seven.businesses b USING(business_id)
      JOIN seven.inventory_windows w USING(offering_id)
      WHERE b.slug='ora-lagos' AND w.starts_at>now()+interval '2 days'
      ORDER BY w.starts_at LIMIT 1`,
    );
    assert.ok(inventory);
    const journals = () =>
      rows(
        pool,
        `SELECT j.money_journal_id,j.source_reference,j.currency_code,
        p.money_posting_id,p.account_code,p.amount_minor
        FROM seven.money_journals j JOIN seven.money_postings p USING(money_journal_id)
        ORDER BY j.money_journal_id,p.money_posting_id`,
      );

    for (const contradiction of ['identity', 'amount'] as const) {
      await t.test(
        `a delayed completed observation with a different ${contradiction} is flagged`,
        async () => {
          const provider = new MockProvider();
          const reservation = await transaction(appPool, async (db) => {
            const quote = await createQuote(db, guest, {
              offeringId: inventory.offering_id,
              startDate: inventory.service_date,
              windowId: inventory.inventory_window_id,
              quantity: 1,
            });
            return createReservation(db, guest, quote.id);
          });
          const intent = await checkout(
            appPool,
            provider,
            guest,
            reservation.id,
            'http://localhost:5177',
          );
          provider.receipts.set(intent.reference, {
            id: `synthetic-receipt-${randomUUID()}`,
            reference: intent.reference,
            status: 'successful',
            currency: 'NGN',
            amountMinor: Number(reservation.price.totalMinor),
            feeMinor: 100,
          });
          const payment = await verifyPayment(appPool, provider, guest, intent.reference);
          assert.equal(payment.status, 'PAID');
          const booked = await reservationProjection(appPool, reservation.id);
          assert.ok(booked);
          await transaction(appPool, (db) =>
            actOnReservation(db, guest, reservation.id, {
              action: 'CANCEL',
              expectedRevision: booked.revision,
              reason: 'Synthetic refund concurrency fixture',
            }),
          );
          const completed: ProviderRefund = {
            id: `synthetic-refund-${randomUUID()}`,
            status: 'completed-bank-transfer',
            amountMinor: Number(payment.amountMinor),
          };
          let dispatches = 0;
          provider.refund = async (_transactionId, amountMinor) => {
            dispatches++;
            assert.equal(amountMinor, completed.amountMinor);
            return { ...completed, status: 'processing' };
          };
          const pending = await requestRefund(
            appPool,
            provider,
            admin,
            reservation.id,
            'Synthetic reviewed refund',
          );
          assert.equal(pending.status, 'REFUND_PENDING');
          const refund = await one(
            pool,
            'SELECT * FROM seven.refunds WHERE payment_attempt_id=$1',
            [payment.id],
          );
          assert.ok(refund);
          assert.equal(refund.provider_refund_id, completed.id);

          const entered = deferred<void>();
          const delayed = deferred<ProviderRefund>();
          let lookups = 0;
          provider.refundStatus = async (id) => {
            assert.equal(id, completed.id);
            if (++lookups === 1) {
              entered.resolve();
              return delayed.promise;
            }
            return completed;
          };
          const inFlight = reconcile(appPool, provider);
          try {
            await Promise.race([
              entered.promise,
              inFlight.then(() => {
                throw new Error('The first reconciliation never entered its provider lookup.');
              }),
            ]);
            // Make the durable claim due again while its original provider request is still in flight.
            await pool.query(
              "UPDATE seven.refunds SET provider_details=provider_details||jsonb_build_object('nextRecoveryAt',now()-interval '1 second') WHERE refund_id=$1",
              [refund.refund_id],
            );
            assert.equal((await reconcile(appPool, provider)).exceptions, 0);
            const delivered = await one(
              pool,
              'SELECT f.*,s.workflow_state_code FROM seven.refunds f JOIN seven.workflow_states s USING(workflow_state_id) WHERE refund_id=$1',
              [refund.refund_id],
            );
            assert.equal(delivered?.workflow_state_code, 'DELIVERED');
            assert.equal(delivered?.provider_details.exception, undefined);
            const beforeLateObservation = await journals();
            delayed.resolve({
              ...completed,
              ...(contradiction === 'identity'
                ? { id: `contradictory-${randomUUID()}` }
                : { amountMinor: completed.amountMinor + 1 }),
            });
            assert.equal((await inFlight).exceptions, 0);

            const observed = await one(
              pool,
              'SELECT f.*,s.workflow_state_code FROM seven.refunds f JOIN seven.workflow_states s USING(workflow_state_id) WHERE refund_id=$1',
              [refund.refund_id],
            );
            assert.equal(observed?.workflow_state_code, 'DELIVERED');
            assert.equal(observed?.provider_refund_id, completed.id);
            assert.equal(observed?.amount_minor, String(completed.amountMinor));
            assert.match(String(observed?.provider_details.exception), /contradict/i);
            assert.equal((await paymentProjection(appPool, payment.id))?.status, 'REFUNDED');
            const after = await reservationProjection(appPool, reservation.id);
            assert.equal(after?.status, 'CANCELLED');
            assert.equal(after?.paymentStatus, 'REFUNDED');
            assert.deepEqual(await journals(), beforeLateObservation);
            const reversals = await rows(
              pool,
              `SELECT j.money_journal_id,j.currency_code,sum(p.amount_minor)::text AS balance
            FROM seven.money_journals j JOIN seven.money_postings p USING(money_journal_id)
            WHERE j.source_reference=$1 GROUP BY j.money_journal_id,j.currency_code`,
              [`refund:${refund.refund_id}`],
            );
            assert.equal(reversals.length, 1);
            assert.equal(reversals[0]?.currency_code, 'NGN');
            assert.equal(reversals[0]?.balance, '0');
            const overview = await fetch(`${base}/admin/overview`, {
              headers: { Origin: origin, Cookie: adminCookie },
            });
            assert.equal(overview.status, 200);
            const overviewBody = (await overview.json()) as { data: AdminOverview };
            const exception = overviewBody.data.exceptions.find(
              (item) => item.id === refund.refund_id && item.kind === 'REFUND',
            );
            assert.ok(
              exception,
              'Delivered refund contradictions must reach the admin review queue.',
            );
            assert.match(exception.message, /DELIVERED/);
            assert.match(exception.message, /contradict/i);
            assert.equal(lookups, 2);
            assert.equal(dispatches, 1, 'Recovery must never dispatch a second refund.');
          } finally {
            delayed.resolve(completed);
            await inFlight;
          }
        },
      );
    }
  } finally {
    if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
    if (appPool !== pool) await appPool.end();
    await pool.end();
  }
});
