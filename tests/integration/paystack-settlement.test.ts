import assert from 'node:assert/strict';
import test from 'node:test';
import { MockCryptoGateway } from '../../services/platform/src/cryptoProvider.ts';
import { createPool, one, rows, transaction } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { checkout, verifyPayment } from '../../services/platform/src/payments.ts';
import { reconcilePaystackSettlements } from '../../services/platform/src/paystackSettlement.ts';
import type { PaymentProvider } from '../../services/platform/src/provider.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { ProviderRegistry } from '../../services/platform/src/providerRegistry.ts';
import { createQuote, createReservation } from '../../services/platform/src/reservations.ts';
import { seed } from '../../services/platform/src/seed.ts';
import { paymentProjection, userProjection } from '../../services/platform/src/store.ts';

test('Paystack settlement reports remain observations until bank delivery is independently established', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 90000,
}, async (t) => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  const appPool = process.env.TEST_RUNTIME_DATABASE_URL
    ? createPool(process.env.TEST_RUNTIME_DATABASE_URL)
    : pool;
  try {
    const identity =
      'SELECT current_database() AS name,inet_server_addr()::text AS address,inet_server_port() AS port';
    const owner = await one(pool, identity);
    assert.match(String(owner?.name), /_test_db$/);
    assert.deepEqual(
      await one(appPool, identity),
      owner,
      'Both connections must use the same isolated test database before reset.',
    );
    await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
    await migrate(pool);
    await seed(pool, 'Paystack-settlement-fixture-only-42!');
    const guest = await one(pool, "SELECT user_id FROM seven.users WHERE email='guest@seven.test'");
    assert.ok(guest);
    const projectedActor = await userProjection(appPool, guest.user_id);
    assert.ok(projectedActor);
    const actor = projectedActor;
    const inventoryRow = await one(
      pool,
      `SELECT o.offering_id,o.business_id,w.inventory_window_id,
      to_char(w.starts_at AT TIME ZONE 'Africa/Lagos','YYYY-MM-DD') AS service_date
      FROM seven.offerings o JOIN seven.businesses b USING(business_id)
      JOIN seven.inventory_windows w USING(offering_id)
      WHERE b.slug='ora-lagos' AND w.starts_at>now()+interval '2 days' ORDER BY w.starts_at LIMIT 1`,
    );
    assert.ok(inventoryRow);
    const inventory = inventoryRow;
    await pool.query(
      "UPDATE seven.business_payment_accounts SET execution_mode_id=(SELECT execution_mode_id FROM seven.execution_modes WHERE execution_mode_code='paystack') WHERE business_id=$1 AND payment_provider_id=(SELECT payment_provider_id FROM seven.payment_providers WHERE provider_code='paystack')",
      [inventory.business_id],
    );
    const mock = new MockProvider();
    let lookups = 0;
    let receiptSequence = 100000;
    let report: Record<string, unknown>[] = [];
    let failLookup = false;
    let inspectClaim: (() => Promise<void>) | undefined;
    const adapter: PaymentProvider = {
      mode: 'paystack',
      checkout: mock.checkout.bind(mock),
      verify: mock.verify.bind(mock),
      refund: mock.refund.bind(mock),
      refundStatus: mock.refundStatus.bind(mock),
      subaccount: mock.subaccount.bind(mock),
      settlements: async () => {
        lookups++;
        await inspectClaim?.();
        if (failLookup) throw new Error('Synthetic provider lookup timeout');
        return report;
      },
    };
    async function fixture() {
      const reservation = await transaction(appPool, async (db) => {
        const quote = await createQuote(db, actor, {
          offeringId: inventory.offering_id,
          startDate: inventory.service_date,
          windowId: inventory.inventory_window_id,
          quantity: 1,
        });
        return createReservation(db, actor, quote.id);
      });
      const intent = await checkout(
        appPool,
        adapter,
        actor,
        reservation.id,
        'http://localhost:5177',
      );
      const receipt = {
        id: String(++receiptSequence),
        reference: intent.reference,
        status: 'successful',
        currency: 'NGN',
        amountMinor: Number(reservation.price.totalMinor),
        feeMinor: 100,
      };
      mock.receipts.set(intent.reference, receipt);
      const payment = await verifyPayment(appPool, adapter, actor, intent.reference);
      const attempt = await one(
        pool,
        'SELECT * FROM seven.payment_attempts WHERE payment_attempt_id=$1',
        [payment.id],
      );
      assert.ok(attempt);
      const transactionEvidence: Record<string, unknown> = {
        id: receipt.id,
        reference: receipt.reference,
        status: 'success',
        currency: 'NGN',
        amount: String(receipt.amountMinor),
        fees: '100',
      };
      const summary: Record<string, unknown> = {
        id: '9876',
        status: 'success',
        currency: 'NGN',
        queriedSubaccount: attempt.business_subaccount,
        transactionsComplete: true,
        bankSettlementEvidence: false,
        transactions: [transactionEvidence],
      };
      report = [summary];
      failLookup = false;
      return { payment, attempt, summary, transactionEvidence };
    }
    const journalSnapshot = () =>
      rows(
        pool,
        'SELECT j.money_journal_id,j.source_reference,p.money_posting_id,p.account_code,p.amount_minor FROM seven.money_journals j JOIN seven.money_postings p USING(money_journal_id) ORDER BY j.money_journal_id,p.money_posting_id',
      );

    await t.test(
      'provider success records redacted evidence and stays pending without financial changes',
      async () => {
        const current = await fixture();
        current.transactionEvidence.authorization = {
          reusableSecret: 'excluded-synthetic-fixture',
        };
        const before = await journalSnapshot();
        assert.deepEqual(await reconcilePaystackSettlements(appPool, adapter), {
          processed: 0,
          pending: 1,
          exceptions: 0,
        });
        const payment = await paymentProjection(appPool, current.payment.id);
        assert.equal(payment?.settlementStatus, 'PENDING');
        assert.equal(payment?.feeMinor, '100');
        const stored = await one(
          pool,
          'SELECT provider_details FROM seven.payment_attempts WHERE payment_attempt_id=$1',
          [current.payment.id],
        );
        const evidence = stored?.provider_details.providerReportedSettlement;
        assert.equal(evidence?.reference, '9876');
        assert.equal(evidence?.status, 'success');
        assert.equal(evidence?.bankDeliveryConfirmed, false);
        assert.equal(evidence?.transaction?.reference, current.payment.reference);
        assert.equal(evidence?.transaction?.amountMinor, current.payment.amountMinor);
        assert.equal(evidence?.transaction?.feeMinor, '100');
        assert.ok(Number.isFinite(Date.parse(evidence?.retrievedAt)));
        assert.equal(JSON.stringify(evidence).includes('reusableSecret'), false);
        assert.match(stored?.provider_details.settlementException, /bank/i);
        assert.deepEqual(await journalSnapshot(), before);
        const calls = lookups;
        assert.deepEqual(await reconcilePaystackSettlements(appPool, adapter), {
          processed: 0,
          pending: 0,
          exceptions: 0,
        });
        assert.equal(lookups, calls);
      },
    );

    await t.test(
      'mismatched identity, currency, amount, fee and invented bank-net evidence flag review only',
      async () => {
        for (const change of [
          { id: 'wrong-id' },
          { reference: 'wrong-reference' },
          { currency: 'USD' },
          { amount: '1' },
          { fees: '101' },
          { settlement_amount: '0.01' },
        ]) {
          const current = await fixture();
          Object.assign(current.transactionEvidence, change);
          const before = await journalSnapshot();
          assert.deepEqual(await reconcilePaystackSettlements(appPool, adapter), {
            processed: 0,
            pending: 0,
            exceptions: 1,
          });
          const payment = await paymentProjection(appPool, current.payment.id);
          assert.equal(payment?.settlementStatus, 'FLAGGED');
          assert.equal(payment?.feeMinor, '100');
          assert.equal(payment?.providerTransactionId, current.payment.providerTransactionId);
          assert.deepEqual(await journalSnapshot(), before);
        }
      },
    );

    await t.test(
      'timeouts consume a durable backoff attempt and exhausted checks stay flagged',
      async () => {
        const current = await fixture();
        failLookup = true;
        const before = await journalSnapshot();
        assert.deepEqual(await reconcilePaystackSettlements(appPool, adapter), {
          processed: 0,
          pending: 0,
          exceptions: 1,
        });
        const attempts = await one(
          pool,
          'SELECT settlement_checks,next_settlement_check_at FROM seven.payment_attempts WHERE payment_attempt_id=$1',
          [current.payment.id],
        );
        assert.equal(attempts?.settlement_checks, 1);
        assert.ok(Date.parse(attempts?.next_settlement_check_at) > Date.now() + 14 * 60000);
        const calls = lookups;
        await reconcilePaystackSettlements(appPool, adapter);
        assert.equal(lookups, calls);
        failLookup = false;
        await pool.query(
          'UPDATE seven.payment_attempts SET settlement_checks=11,next_settlement_check_at=now() WHERE payment_attempt_id=$1',
          [current.payment.id],
        );
        let durableClaim: Record<string, unknown> | undefined;
        inspectClaim = async () => {
          durableClaim = await one(
            pool,
            'SELECT s.workflow_state_code,p.provider_details,p.settlement_checks FROM seven.payment_attempts p JOIN seven.workflow_states s ON s.workflow_state_id=p.settlement_state_id WHERE payment_attempt_id=$1',
            [current.payment.id],
          );
        };
        try {
          assert.deepEqual(await reconcilePaystackSettlements(appPool, adapter), {
            processed: 0,
            pending: 0,
            exceptions: 1,
          });
        } finally {
          inspectClaim = undefined;
        }
        assert.equal(
          durableClaim?.workflow_state_code,
          'FLAGGED',
          'The twelfth claim is already flagged if the process dies during its provider lookup.',
        );
        assert.equal(durableClaim?.settlement_checks, 12);
        assert.match(
          String((durableClaim?.provider_details as Record<string, unknown>)?.settlementException),
          /exhausted/i,
        );
        assert.equal(
          (await paymentProjection(appPool, current.payment.id))?.settlementStatus,
          'FLAGGED',
        );
        await pool.query(
          'UPDATE seven.payment_attempts SET next_settlement_check_at=now() WHERE payment_attempt_id=$1',
          [current.payment.id],
        );
        const exhaustedCalls = lookups;
        await reconcilePaystackSettlements(appPool, adapter);
        assert.equal(lookups, exhaustedCalls);
        assert.deepEqual(await journalSnapshot(), before);
      },
    );

    await t.test(
      'a failed provider report remains attributable and flags review without changing funding',
      async () => {
        const current = await fixture();
        current.summary.status = 'failed';
        const before = await journalSnapshot();
        assert.deepEqual(await reconcilePaystackSettlements(appPool, adapter), {
          processed: 0,
          pending: 0,
          exceptions: 1,
        });
        const payment = await paymentProjection(appPool, current.payment.id);
        assert.equal(payment?.status, 'PAID');
        assert.equal(payment?.settlementStatus, 'FLAGGED');
        const stored = await one(
          pool,
          'SELECT provider_details FROM seven.payment_attempts WHERE payment_attempt_id=$1',
          [current.payment.id],
        );
        assert.equal(stored?.provider_details.providerReportedSettlement?.status, 'failed');
        assert.equal(stored?.provider_details.bankDeliveryConfirmed, false);
        assert.deepEqual(await journalSnapshot(), before);
      },
    );

    await t.test(
      'competing workers claim one observation and mock or missing adapters are no-ops',
      async () => {
        const current = await fixture();
        const before = await journalSnapshot();
        const calls = lookups;
        const results = await Promise.all([
          reconcilePaystackSettlements(appPool, adapter),
          reconcilePaystackSettlements(appPool, adapter),
        ]);
        assert.equal(
          results.reduce((sum, result) => sum + result.pending, 0),
          1,
        );
        assert.equal(lookups, calls + 1);
        assert.equal(
          (await paymentProjection(appPool, current.payment.id))?.settlementStatus,
          'PENDING',
        );
        assert.deepEqual(await reconcilePaystackSettlements(appPool, new MockProvider()), {
          processed: 0,
          pending: 0,
          exceptions: 0,
        });
        assert.deepEqual(
          await reconcilePaystackSettlements(
            appPool,
            new ProviderRegistry({ mode: 'live', adapters: {}, crypto: new MockCryptoGateway() }),
          ),
          { processed: 0, pending: 0, exceptions: 0 },
        );
        assert.deepEqual(await journalSnapshot(), before);
      },
    );

    await t.test(
      'one pass queries at most three subaccounts and leaves remaining work due',
      async () => {
        const fixtures: Awaited<ReturnType<typeof fixture>>[] = [];
        const currentAccount = await one(
          pool,
          'SELECT account_code FROM seven.business_payment_accounts WHERE business_id=$1 AND payment_provider_id=2',
          [inventory.business_id],
        );
        assert.ok(currentAccount);
        try {
          for (let index = 0; index < 4; index++) {
            await pool.query(
              'UPDATE seven.business_payment_accounts SET account_code=$2 WHERE business_id=$1 AND payment_provider_id=2',
              [inventory.business_id, `ACCT_bounded${index}`],
            );
            fixtures.push(await fixture());
          }
          report = fixtures.map((entry) => entry.summary);
          const before = await journalSnapshot();
          const calls = lookups;
          assert.deepEqual(await reconcilePaystackSettlements(appPool, adapter), {
            processed: 0,
            pending: 3,
            exceptions: 0,
          });
          assert.equal(lookups, calls + 3);
          const untouched = await one(
            pool,
            'SELECT settlement_checks FROM seven.payment_attempts WHERE payment_attempt_id=$1',
            [fixtures[3]?.payment.id],
          );
          assert.equal(untouched?.settlement_checks, 0);
          assert.deepEqual(await reconcilePaystackSettlements(appPool, adapter), {
            processed: 0,
            pending: 1,
            exceptions: 0,
          });
          assert.equal(lookups, calls + 4);
          assert.deepEqual(await journalSnapshot(), before);
        } finally {
          await pool.query(
            'UPDATE seven.business_payment_accounts SET account_code=$2 WHERE business_id=$1 AND payment_provider_id=2',
            [inventory.business_id, currentAccount.account_code],
          );
        }
      },
    );
  } finally {
    if (appPool !== pool) await appPool.end();
    await pool.end();
  }
});
