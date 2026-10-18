import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type * as C from '@7even/contracts';
import type { Pool } from 'pg';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../../services/platform/src/app.ts';
import type { CryptoQuoteData } from '../../services/platform/src/cryptoProvider.ts';
import { MockCryptoGateway } from '../../services/platform/src/cryptoProvider.ts';
import { createPool, one, rows, transaction } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { PaystackProvider } from '../../services/platform/src/paystackProvider.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { ProviderRegistry, providerIds } from '../../services/platform/src/providerRegistry.ts';
import { seed } from '../../services/platform/src/seed.ts';
import { moneyJournal, sid } from '../../services/platform/src/store.ts';
import { processInbox } from '../../services/platform/src/worker.ts';

const origin = 'http://localhost:5177';
const password = 'Isolated-multi-provider-passphrase-42!';

interface Result<T> {
  status: number;
  data: T;
  error?: { code: string; message: string };
}

class Client {
  base: string;
  cookie = '';
  csrf = '';
  constructor(base: string) {
    this.base = base;
  }
  async request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    key: string = randomUUID(),
  ): Promise<Result<T>> {
    const response = await fetch(`${this.base}/api${path}`, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: this.cookie,
        'X-CSRF-Token': this.csrf,
        'Idempotency-Key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const cookie = response.headers.get('set-cookie');
    if (cookie) this.cookie = cookie.split(';')[0] ?? '';
    return { status: response.status, ...((await response.json()) as Omit<Result<T>, 'status'>) };
  }
  async login(email: string): Promise<C.SessionUser> {
    const result = await this.request<C.SessionData>('/auth/login', 'POST', { email, password });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.ok(result.data.user);
    assert.ok(result.data.csrfToken);
    this.csrf = result.data.csrfToken;
    return result.data.user;
  }
}

/** Build the actual pre-upgrade schema, retaining checksums so the normal runner applies 009. */
async function legacySchema(pool: Pool): Promise<void> {
  const directory = new URL('../../database/migrations/', import.meta.url);
  const files = (await readdir(directory)).filter((name) => /^00[1-8]_.*\.sql$/.test(name)).sort();
  assert.equal(files.length, 8);
  for (const filename of files) {
    const sql = await readFile(new URL(filename, directory), 'utf8');
    await transaction(pool, async (db) => {
      await db.query(sql);
      await db.query(`CREATE TABLE IF NOT EXISTS seven.migrations (
        migration_id bigint GENERATED ALWAYS AS IDENTITY,
        migration_name varchar(180) NOT NULL, checksum varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT migrations_pk PRIMARY KEY(migration_id), CONSTRAINT migrations_name_uk UNIQUE(migration_name));
        ALTER TABLE seven.migrations OWNER TO seven_owner;
        GRANT SELECT ON seven.migrations TO seven_app, seven_readonly;`);
      await db.query('INSERT INTO seven.migrations(migration_name,checksum) VALUES($1,$2)', [
        filename,
        createHash('sha256').update(sql).digest('hex'),
      ]);
    });
  }
}

async function legacyReceipt(pool: Pool): Promise<{ reservationId: string; paymentId: string }> {
  const [userId, businessId, offeringId, quoteId, reservationId, paymentId] = Array.from(
    { length: 6 },
    () => randomUUID(),
  );
  assert.ok(userId && businessId && offeringId && quoteId && reservationId && paymentId);
  await transaction(pool, async (db) => {
    await db.query(
      `INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id)
       VALUES($1,'legacy@multi-provider.test','Legacy fixture','not-a-login-hash',
       (SELECT role_id FROM seven.roles WHERE role_code='CUSTOMER'))`,
      [userId],
    );
    await db.query(
      `INSERT INTO seven.businesses(business_id,business_name,slug,city,workflow_state_id,subaccount_id,bank_revision,details)
       VALUES($1,'Legacy business','legacy-multi-provider','Lagos',${sid('APPROVED')},'RS_LEGACY',1,'{"subaccountMode":"mock"}')`,
      [businessId],
    );
    await db.query(
      `INSERT INTO seven.offerings(offering_id,business_id,sector_id,title,description,city,price_minor)
       VALUES($1,$2,(SELECT sector_id FROM seven.sectors WHERE sector_code='STAY'),'Legacy room','Isolated migration fixture','Lagos',100000)`,
      [offeringId, businessId],
    );
    await db.query(
      `INSERT INTO seven.quotes(quote_id,user_id,offering_id,starts_at,ends_at,quantity,amounts,inventory_ids,expires_at,terms_snapshot)
       VALUES($1,$2,$3,now()+interval '10 days',now()+interval '11 days',1,$4,'[]',now()+interval '10 minutes','{}')`,
      [
        quoteId,
        userId,
        offeringId,
        {
          subtotalMinor: '100000',
          discountMinor: '0',
          serviceMinor: '100000',
          taxMinor: '0',
          totalMinor: '100000',
          commissionMinor: '10000',
          businessGrossMinor: '90000',
        },
      ],
    );
    await db.query(
      `INSERT INTO seven.reservations(reservation_id,user_id,business_id,offering_id,quote_id,workflow_state_id,payment_state_id,expires_at)
       VALUES($1,$2,$3,$4,$5,${sid('CANCELLED')},${sid('PAID')},now()+interval '10 minutes')`,
      [reservationId, userId, businessId, offeringId, quoteId],
    );
    await db.query(
      `INSERT INTO seven.payment_attempts(payment_attempt_id,reservation_id,merchant_reference,provider_transaction_id,
       workflow_state_id,settlement_state_id,currency_code,amount_minor,commission_minor,business_subaccount,bank_revision,provider_details)
       VALUES($1,$2,'seven-legacy-fixture','12345',${sid('PAID')},${sid('UNSETTLED')},'NGN',100000,10000,'RS_LEGACY',1,'{"mode":"mock","feeMinor":"0"}')`,
      [paymentId, reservationId],
    );
    await db.query(
      'UPDATE seven.reservations SET funding_payment_attempt_id=$2 WHERE reservation_id=$1',
      [reservationId, paymentId],
    );
    await moneyJournal(db, 'receipt:12345', 'Legacy receipt before provider-scoped identities', [
      { account: 'provider-clearing', amount: '100000' },
      { account: `business:${businessId}`, amount: '-90000' },
      { account: 'platform-commission', amount: '-10000' },
    ]);
  });
  return { reservationId, paymentId };
}

test('multi-provider PostgreSQL API, upgrade and financial invariants', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 120000,
}, async (t) => {
  const ownerUrl = process.env.TEST_DATABASE_URL;
  assert.ok(ownerUrl);
  const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL ?? ownerUrl;
  assert.equal(
    new URL(ownerUrl).pathname,
    new URL(runtimeUrl).pathname,
    'Owner and runtime URLs must select the same isolated database.',
  );
  const pool = createPool(ownerUrl);
  const appPool = runtimeUrl === ownerUrl ? pool : createPool(runtimeUrl);
  let server: Server | undefined;
  try {
    const identitySql =
      'SELECT current_database() AS name,inet_server_addr()::text AS address,inet_server_port() AS port';
    const ownerIdentity = await one(pool, identitySql);
    const runtimeIdentity = await one(appPool, identitySql);
    assert.match(
      String(ownerIdentity?.name),
      /_test_db$/,
      'Only the isolated test database can be reset.',
    );
    assert.deepEqual(
      runtimeIdentity,
      ownerIdentity,
      'The restricted runtime must use the same test server and database before any reset.',
    );
    await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
    await legacySchema(pool);
    const legacy = await legacyReceipt(pool);
    const original = await rows(
      pool,
      "SELECT j.*,p.money_posting_id,p.account_code,p.amount_minor FROM seven.money_journals j JOIN seven.money_postings p USING(money_journal_id) WHERE j.source_reference='receipt:12345' ORDER BY p.account_code",
    );
    await migrate(pool);
    await seed(pool, password);
    const flutterwave = new MockProvider();
    const paystack = new MockProvider();
    let crypto = new MockCryptoGateway();
    const providers = new ProviderRegistry({
      mode: 'mock',
      adapters: { flutterwave, paystack },
      crypto,
    });
    async function start(): Promise<string> {
      const runtime = createApp({
        pool: appPool,
        providers,
        environment: 'test',
        publicOrigin: origin,
      });
      server = await new Promise<Server>((resolve) => {
        const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }
    let base = await start();
    const guest = new Client(base);
    const friend = new Client(base);
    const host = new Client(base);
    const admin = new Client(base);
    const guestUser = await guest.login('guest@seven.test');
    await friend.login('friend@seven.test');
    const hostUser = await host.login('host@seven.test');
    await admin.login('admin@seven.test');
    const payer = privateKeyToAccount(generatePrivateKey());

    async function hold(totalMinor: string): Promise<C.Reservation> {
      const created = await host.request<C.Offering>('/business/offerings', 'POST', {
        title: `Payment acceptance ${totalMinor}`,
        description: 'Isolated synthetic payment route and wallet acceptance fixture.',
        kind: 'STAY',
        city: 'Lagos',
        address: 'Isolated test venue, Lagos',
        priceMinor: totalMinor,
        capacity: 20,
        published: true,
      });
      assert.equal(created.status, 200, JSON.stringify(created));
      // Tax-free fixture makes each immutable quoted total the exact routing boundary under test.
      await pool.query('UPDATE seven.offerings SET tax_bps=0 WHERE offering_id=$1', [
        created.data.id,
      ]);
      const startDate = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
      const endDate = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
      const availability = await host.request(
        `/business/offerings/${created.data.id}/availability`,
        'POST',
        { startDate, endDate, capacity: 20 },
      );
      assert.equal(availability.status, 200, JSON.stringify(availability));
      const quote = await guest.request<C.Quote>('/quotes', 'POST', {
        offeringId: created.data.id,
        startDate,
        endDate,
        quantity: 1,
      });
      assert.equal(quote.status, 200, JSON.stringify(quote));
      assert.equal(quote.data.price.totalMinor, totalMinor);
      const held = await guest.request<C.Reservation>('/reservations', 'POST', {
        quoteId: quote.data.id,
      });
      assert.equal(held.status, 200, JSON.stringify(held));
      return held.data;
    }
    const fiat: { reservation: C.Reservation; checkout: C.Checkout }[] = [];

    await t.test(
      '009 preserves historical receipt allocations and refunds their original journal',
      async () => {
        const row = await one(
          pool,
          'SELECT payment_provider_id,routing_policy_version,receipt_journal_reference FROM seven.payment_attempts WHERE payment_attempt_id=$1',
          [legacy.paymentId],
        );
        assert.equal(Number(row?.payment_provider_id), providerIds.flutterwave);
        assert.equal(row?.routing_policy_version, 'legacy-flutterwave');
        assert.equal(row?.receipt_journal_reference, 'receipt:12345');
        assert.deepEqual(
          await rows(
            pool,
            "SELECT j.*,p.money_posting_id,p.account_code,p.amount_minor FROM seven.money_journals j JOIN seven.money_postings p USING(money_journal_id) WHERE j.source_reference='receipt:12345' ORDER BY p.account_code",
          ),
          original,
        );
        const refunded = await admin.request<C.Payment>(
          `/reservations/${legacy.reservationId}/refunds`,
          'POST',
          { reason: 'Legacy migration acceptance refund' },
        );
        assert.equal(refunded.status, 200, JSON.stringify(refunded));
        assert.equal(refunded.data.status, 'REFUNDED');
        const allocations = await rows(
          pool,
          `SELECT p.account_code,sum(p.amount_minor)::text AS total FROM seven.money_postings p JOIN seven.money_journals j USING(money_journal_id) WHERE j.source_reference='receipt:12345' OR j.source_reference IN (SELECT 'refund:'||refund_id FROM seven.refunds WHERE payment_attempt_id=$1) GROUP BY p.account_code`,
          [legacy.paymentId],
        );
        assert.ok(allocations.length >= 3);
        assert.ok(
          allocations.every((entry) => entry.total === '0'),
          JSON.stringify(allocations),
        );
        assert.deepEqual(
          await rows(
            pool,
            "SELECT j.*,p.money_posting_id,p.account_code,p.amount_minor FROM seven.money_journals j JOIN seven.money_postings p USING(money_journal_id) WHERE j.source_reference='receipt:12345' ORDER BY p.account_code",
          ),
          original,
        );
      },
    );

    await t.test(
      'amount boundaries select Paystack through 5000000 kobo and Flutterwave above it',
      async () => {
        for (const [amount, provider] of [
          ['4999999', 'paystack'],
          ['5000000', 'paystack'],
          ['5000001', 'flutterwave'],
        ] as const) {
          const reservation = await hold(amount);
          const options = await guest.request<C.PaymentOptions>(
            `/reservations/${reservation.id}/payment-options`,
          );
          assert.equal(options.status, 200, JSON.stringify(options));
          assert.equal(options.data.fiat.provider, provider);
          assert.equal(options.data.fiat.available, true);
          assert.equal(options.data.crypto.available, true);
          assert.equal(options.data.thresholdMinor, '5000000');
          const checkout = await guest.request<C.Checkout>(
            `/reservations/${reservation.id}/checkout`,
            'POST',
            { method: 'FIAT' },
          );
          assert.equal(checkout.status, 200, JSON.stringify(checkout));
          assert.equal(checkout.data.provider, provider);
          assert.equal(checkout.data.method, 'FIAT');
          fiat.push({ reservation, checkout: checkout.data });
        }
      },
    );

    await t.test(
      'ten first-checkout requests create one durable intent before any retry',
      async () => {
        const reservation = await hold('4000000');
        assert.equal(
          (
            await one(
              pool,
              'SELECT count(*)::text AS total FROM seven.payment_attempts WHERE reservation_id=$1',
              [reservation.id],
            )
          )?.total,
          '0',
        );
        const requests = await Promise.all(
          Array.from({ length: 10 }, () =>
            guest.request<C.Checkout>(`/reservations/${reservation.id}/checkout`, 'POST', {
              method: 'FIAT',
            }),
          ),
        );
        assert.ok(
          requests.every(
            (result) =>
              result.status === 200 ||
              (result.status === 409 && result.error?.code === 'PAYMENT_PENDING'),
          ),
          JSON.stringify(requests),
        );
        const accepted = requests.find((result) => result.status === 200);
        assert.ok(accepted, JSON.stringify(requests));
        const retried = await guest.request<C.Checkout>(
          `/reservations/${reservation.id}/checkout`,
          'POST',
          { method: 'FIAT' },
        );
        assert.equal(retried.status, 200, JSON.stringify(retried));
        assert.equal(retried.data.paymentId, accepted.data.paymentId);
        assert.equal(retried.data.provider, 'paystack');
        assert.equal(
          (
            await one(
              pool,
              'SELECT count(*)::text AS total FROM seven.payment_attempts WHERE reservation_id=$1',
              [reservation.id],
            )
          )?.total,
          '1',
        );
        assert.equal(
          (
            await one(
              pool,
              "SELECT count(*)::text AS total FROM seven.audit_events WHERE action_code='payment.checkout_requested' AND resource_id=$1",
              [accepted.data.paymentId],
            )
          )?.total,
          '1',
        );
      },
    );

    await t.test(
      'concurrent retries retain one checkout, account revision and method after configuration changes',
      async () => {
        const fixture = fiat[1];
        assert.ok(fixture);
        const originalAttempt = await one(
          pool,
          'SELECT * FROM seven.payment_attempts WHERE payment_attempt_id=$1',
          [fixture.checkout.paymentId],
        );
        assert.ok(originalAttempt);
        await pool.query(
          'UPDATE seven.business_payment_accounts SET account_code=$3,revision=revision+1 WHERE business_id=$1 AND payment_provider_id=$2',
          [hostUser.businessId, providerIds.paystack, 'ACCT_revisedfixture'],
        );
        await pool.query('UPDATE seven.offerings SET price_minor=6000000 WHERE offering_id=$1', [
          fixture.reservation.offeringId,
        ]);
        const retries = await Promise.all(
          Array.from({ length: 10 }, () =>
            guest.request<C.Checkout>(`/reservations/${fixture.reservation.id}/checkout`, 'POST', {
              method: 'FIAT',
            }),
          ),
        );
        assert.ok(
          retries.every((result) => result.status === 200),
          JSON.stringify(retries),
        );
        assert.ok(
          retries.every(
            (result) =>
              result.data.paymentId === fixture.checkout.paymentId &&
              result.data.provider === 'paystack',
          ),
        );
        assert.equal(
          (
            await one(
              pool,
              'SELECT count(*)::text AS total FROM seven.payment_attempts WHERE reservation_id=$1',
              [fixture.reservation.id],
            )
          )?.total,
          '1',
        );
        const saved = await one(
          pool,
          'SELECT * FROM seven.payment_attempts WHERE payment_attempt_id=$1',
          [fixture.checkout.paymentId],
        );
        for (const field of [
          'payment_provider_id',
          'payment_method_id',
          'routing_policy_version',
          'business_subaccount',
          'bank_revision',
          'amount_minor',
          'commission_minor',
        ])
          assert.equal(saved?.[field], originalAttempt[field], field);
        const conflict = await guest.request(
          `/reservations/${fixture.reservation.id}/checkout`,
          'POST',
          { method: 'USDC_BASE', payerAddress: payer.address },
        );
        assert.equal(conflict.status, 409, JSON.stringify(conflict));
        assert.equal(conflict.error?.code, 'PAYMENT_METHOD_LOCKED');
        delete providers.adapters.paystack;
        try {
          const unavailable = await guest.request(
            `/reservations/${fixture.reservation.id}/checkout`,
            'POST',
            { method: 'FIAT' },
          );
          assert.equal(unavailable.status, 503, JSON.stringify(unavailable));
          assert.equal(
            (
              await one(
                pool,
                'SELECT payment_provider_id FROM seven.payment_attempts WHERE payment_attempt_id=$1',
                [fixture.checkout.paymentId],
              )
            )?.payment_provider_id,
            String(providerIds.paystack),
          );
        } finally {
          providers.adapters.paystack = paystack;
        }
        await assert.rejects(
          pool.query(
            'UPDATE seven.payment_attempts SET payment_provider_id=$2 WHERE payment_attempt_id=$1',
            [fixture.checkout.paymentId, providerIds.flutterwave],
          ),
          /immutable/i,
        );
      },
    );

    await t.test(
      'a wrong-provider inbox event cannot fund another route or consume its receipt identity',
      async () => {
        const fixture = fiat[2];
        assert.ok(fixture);
        const eventId = randomUUID();
        paystack.receipts.set(fixture.checkout.reference, {
          id: '777',
          reference: fixture.checkout.reference,
          status: 'successful',
          currency: 'NGN',
          amountMinor: Number(fixture.reservation.price.totalMinor),
          feeMinor: 0,
        });
        await pool.query(
          'INSERT INTO seven.provider_events(provider_event_id,event_reference,event_code,details,payment_provider_id) VALUES($1,$2,$3,$4,$5)',
          [
            eventId,
            'charge.success:777:success',
            'charge.success',
            { id: '777', reference: fixture.checkout.reference },
            providerIds.paystack,
          ],
        );
        assert.equal(await processInbox(appPool, providers), 0);
        const untouched = await guest.request<C.Payment>(`/payments/${fixture.checkout.paymentId}`);
        assert.equal(untouched.data.status, 'PENDING');
        assert.equal(untouched.data.providerTransactionId, null);
        assert.equal(
          (
            await one(
              pool,
              'SELECT processed_at FROM seven.provider_events WHERE provider_event_id=$1',
              [eventId],
            )
          )?.processed_at,
          null,
        );
        assert.equal(
          (
            await one(
              pool,
              "SELECT count(*)::text AS total FROM seven.money_journals WHERE source_reference='receipt:paystack:777'",
            )
          )?.total,
          '0',
        );
      },
    );

    await t.test(
      'matching numeric receipt IDs at two providers credit separately and replay once',
      async () => {
        for (const index of [0, 2]) {
          const fixture = fiat[index];
          assert.ok(fixture);
          const adapter = fixture.checkout.provider === 'paystack' ? paystack : flutterwave;
          adapter.receipts.set(fixture.checkout.reference, {
            id: '777',
            reference: fixture.checkout.reference,
            status: 'successful',
            currency: 'NGN',
            amountMinor: Number(fixture.reservation.price.totalMinor),
            feeMinor: 0,
          });
          const outcomes = await Promise.all(
            Array.from({ length: 10 }, () =>
              guest.request<C.Payment>('/payments/verify', 'POST', {
                reference: fixture.checkout.reference,
                transactionId: '777',
              }),
            ),
          );
          assert.ok(
            outcomes.every((result) => result.status === 200 && result.data.status === 'PAID'),
            JSON.stringify(outcomes),
          );
          assert.equal(
            (
              await one(
                pool,
                'SELECT count(*)::text AS total FROM seven.money_journals WHERE source_reference=$1',
                [`receipt:${fixture.checkout.provider}:777`],
              )
            )?.total,
            '1',
          );
        }
        assert.equal(
          (
            await one(
              pool,
              "SELECT count(*)::text AS total FROM seven.payment_attempts WHERE provider_transaction_id='777'",
            )
          )?.total,
          '2',
        );
        const unbalanced = await rows(
          pool,
          'SELECT money_journal_id,currency_code,sum(amount_minor)::text AS total FROM seven.money_postings JOIN seven.money_journals USING(money_journal_id) GROUP BY money_journal_id,currency_code HAVING sum(amount_minor)<>0',
        );
        assert.deepEqual(unbalanced, []);
      },
    );

    await t.test(
      'Paystack HTTP webhooks reject altered raw bytes and replay one authenticated payment only',
      async () => {
        const reservation = await hold('2000000');
        const account = await one(
          pool,
          'SELECT execution_mode_id FROM seven.business_payment_accounts WHERE business_id=$1 AND payment_provider_id=$2',
          [reservation.businessId, providerIds.paystack],
        );
        assert.ok(account);
        const previousKey = process.env.PAYSTACK_SECRET_KEY;
        const secret = 'synthetic-paystack-webhook-fixture';
        process.env.PAYSTACK_SECRET_KEY = secret;
        let webhookServer: Server | undefined;
        let expectedReference = '';
        const adapter = new PaystackProvider(secret, async (url, init) => {
          if (url === 'https://api.paystack.co/transaction/initialize') {
            const input = JSON.parse(String(init?.body)) as {
              reference: string;
              amount: string;
              bearer: string;
            };
            expectedReference = input.reference;
            assert.equal(input.amount, reservation.price.totalMinor);
            assert.equal(input.bearer, 'subaccount');
            return new Response(
              JSON.stringify({
                status: true,
                data: {
                  reference: expectedReference,
                  access_code: 'isolatedfixture',
                  authorization_url: 'https://checkout.paystack.com/isolatedfixture',
                },
              }),
            );
          }
          assert.equal(url, `https://api.paystack.co/transaction/verify/${expectedReference}`);
          return new Response(
            JSON.stringify({
              status: true,
              data: {
                id: 8844,
                reference: expectedReference,
                status: 'success',
                currency: 'NGN',
                amount: Number(reservation.price.totalMinor),
                fees: 30000,
              },
            }),
          );
        });
        const webhookProviders = new ProviderRegistry({
          mode: 'live',
          adapters: { paystack: adapter },
          crypto: new MockCryptoGateway(),
        });
        try {
          await pool.query(
            'UPDATE seven.business_payment_accounts SET execution_mode_id=(SELECT execution_mode_id FROM seven.execution_modes WHERE execution_mode_code=$3) WHERE business_id=$1 AND payment_provider_id=$2',
            [reservation.businessId, providerIds.paystack, 'paystack'],
          );
          const runtime = createApp({
            pool: appPool,
            providers: webhookProviders,
            environment: 'test',
            publicOrigin: origin,
          });
          webhookServer = await new Promise<Server>((resolve) => {
            const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
          });
          const webhookBase = `http://127.0.0.1:${(webhookServer.address() as AddressInfo).port}`;
          const payerClient = new Client(webhookBase);
          payerClient.cookie = guest.cookie;
          payerClient.csrf = guest.csrf;
          const checkout = await payerClient.request<C.Checkout>(
            `/reservations/${reservation.id}/checkout`,
            'POST',
            { method: 'FIAT' },
          );
          assert.equal(checkout.status, 200, JSON.stringify(checkout));
          assert.equal(checkout.data.mode, 'paystack');
          const event = JSON.stringify({
            event: 'charge.success',
            data: { id: 8844, reference: checkout.data.reference, status: 'success' },
          });
          const signature = createHmac('sha512', secret).update(event).digest('hex');
          const deliver = (body: string, signed = signature) =>
            fetch(`${webhookBase}/api/webhooks/paystack`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signed },
              body,
            });
          assert.equal((await deliver(` ${event}`)).status, 401);
          assert.equal((await deliver(event, '0'.repeat(128))).status, 401);
          assert.equal(
            (await payerClient.request<C.Payment>(`/payments/${checkout.data.paymentId}`)).data
              .status,
            'PENDING',
          );
          assert.equal((await deliver(event)).status, 200);
          for (let attempt = 0; attempt < 50; attempt++) {
            const payment = await payerClient.request<C.Payment>(
              `/payments/${checkout.data.paymentId}`,
            );
            if (payment.data.status === 'PAID') break;
            await processInbox(appPool, webhookProviders);
            await new Promise<void>((resolve) => setTimeout(resolve, 10));
          }
          const paid = await payerClient.request<C.Payment>(`/payments/${checkout.data.paymentId}`);
          assert.equal(paid.data.status, 'PAID', JSON.stringify(paid));
          const replays = await Promise.all(Array.from({ length: 10 }, () => deliver(event)));
          assert.ok(replays.every((response) => response.status === 200));
          assert.equal(
            (
              await one(
                pool,
                "SELECT count(*)::text AS total FROM seven.provider_events WHERE payment_provider_id=$1 AND details->>'reference'=$2",
                [providerIds.paystack, checkout.data.reference],
              )
            )?.total,
            '1',
          );
          assert.equal(
            (
              await one(
                pool,
                "SELECT count(*)::text AS total FROM seven.money_journals WHERE source_reference='receipt:paystack:8844'",
              )
            )?.total,
            '1',
          );
          const other = fiat[2];
          assert.ok(other);
          const wrongProvider = JSON.stringify({
            event: 'charge.success',
            data: { id: 998877, reference: other.checkout.reference, status: 'success' },
          });
          assert.equal(
            (
              await deliver(
                wrongProvider,
                createHmac('sha512', secret).update(wrongProvider).digest('hex'),
              )
            ).status,
            409,
          );
          assert.equal(
            (
              await one(
                pool,
                "SELECT count(*)::text AS total FROM seven.provider_events WHERE payment_provider_id=$1 AND details->>'id'='998877'",
                [providerIds.paystack],
              )
            )?.total,
            '0',
          );
          await processInbox(appPool, webhookProviders);
          const unchanged = await guest.request<C.Payment>(`/payments/${other.checkout.paymentId}`);
          assert.equal(unchanged.data.provider, 'flutterwave');
          assert.equal(unchanged.data.providerTransactionId, '777');
          assert.equal(
            (
              await one(
                pool,
                "SELECT count(*)::text AS total FROM seven.money_journals WHERE source_reference='receipt:paystack:998877'",
              )
            )?.total,
            '0',
          );
        } finally {
          if (webhookServer)
            await new Promise<void>((resolve, reject) =>
              webhookServer?.close((error) => (error ? reject(error) : resolve())),
            );
          await pool.query(
            'UPDATE seven.business_payment_accounts SET execution_mode_id=$3 WHERE business_id=$1 AND payment_provider_id=$2',
            [reservation.businessId, providerIds.paystack, account.execution_mode_id],
          );
          if (previousKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
          else process.env.PAYSTACK_SECRET_KEY = previousKey;
        }
      },
    );

    let pendingCrypto: { checkout: C.Checkout; quote: CryptoQuoteData; hash: string } | undefined;
    await t.test(
      'USDC freezes the full business-wallet quote and requires payer ownership before accepting a hash',
      async () => {
        const reservation = await hold('15000000');
        const checkout = await guest.request<C.Checkout>(
          `/reservations/${reservation.id}/checkout`,
          'POST',
          { method: 'USDC_BASE', payerAddress: payer.address },
        );
        assert.equal(checkout.status, 200, JSON.stringify(checkout));
        assert.equal(checkout.data.provider, 'crypto');
        const payment = await guest.request<C.Payment>(`/payments/${checkout.data.paymentId}`);
        assert.equal(payment.status, 200, JSON.stringify(payment));
        assert.ok(payment.data.crypto);
        const quote = payment.data.crypto.quote;
        assert.equal(quote.decimals, 6);
        assert.equal(quote.chainId, 84532);
        assert.equal(quote.amountAtoms, '100000000');
        assert.equal(quote.payerAddress.toLowerCase(), payer.address.toLowerCase());
        const account = await one(
          pool,
          'SELECT account_code FROM seven.business_payment_accounts WHERE business_id=$1 AND payment_provider_id=$2',
          [reservation.businessId, providerIds.crypto],
        );
        assert.equal(
          quote.recipientAddress.toLowerCase(),
          String(account?.account_code).toLowerCase(),
        );
        assert.equal(payment.data.method, 'USDC_BASE');
        assert.equal(payment.data.settlementKind, 'WALLET');
        const hash = `0x${'a'.repeat(64)}`;
        const unsigned = await guest.request('/payments/verify', 'POST', {
          reference: checkout.data.reference,
          transactionId: hash,
        });
        assert.equal(unsigned.status, 403, JSON.stringify(unsigned));
        const stored = await one(
          pool,
          'SELECT transaction_hash,payer_verified_at FROM seven.crypto_payment_quotes WHERE payment_attempt_id=$1',
          [checkout.data.paymentId],
        );
        assert.equal(stored?.transaction_hash, null);
        assert.equal(stored?.payer_verified_at, null);
        const wrongWallet = privateKeyToAccount(generatePrivateKey());
        const forged = await guest.request('/payments/verify', 'POST', {
          reference: checkout.data.reference,
          transactionId: hash,
          walletSignature: await wrongWallet.signMessage({ message: quote.message }),
        });
        assert.equal(forged.status, 403, JSON.stringify(forged));
        const signature = await payer.signMessage({ message: quote.message });
        const pending = await guest.request<C.Payment>('/payments/verify', 'POST', {
          reference: checkout.data.reference,
          transactionId: hash,
          walletSignature: signature,
        });
        assert.equal(pending.status, 200, JSON.stringify(pending));
        assert.equal(pending.data.status, 'PENDING');
        assert.equal(pending.data.crypto?.payerVerified, true);
        assert.equal(pending.data.commissionOwedMinor, '0');
        assert.equal(
          (
            await one(
              pool,
              'SELECT count(*)::text AS total FROM seven.money_journals WHERE source_reference=$1',
              [`receipt:crypto:84532:${hash}`],
            )
          )?.total,
          '0',
        );
        pendingCrypto = { checkout: checkout.data, quote, hash };
      },
    );

    await t.test(
      'pending crypto survives server restart and credits finalized direct delivery once as a commission receivable',
      async () => {
        assert.ok(pendingCrypto);
        const fixture = pendingCrypto;
        assert.ok(server);
        await new Promise<void>((resolve, reject) =>
          server?.close((error) => (error ? reject(error) : resolve())),
        );
        server = undefined;
        crypto = new MockCryptoGateway();
        crypto.complete(pendingCrypto.quote, pendingCrypto.hash);
        providers.crypto = crypto;
        base = await start();
        for (const client of [guest, friend, host, admin]) client.base = base;
        const results = await Promise.all(
          Array.from({ length: 10 }, () =>
            guest.request<C.Payment>('/payments/verify', 'POST', {
              reference: fixture.checkout.reference,
            }),
          ),
        );
        assert.ok(
          results.every((result) => result.status === 200 && result.data.status === 'PAID'),
          JSON.stringify(results),
        );
        const paid = results[0]?.data;
        assert.ok(paid);
        assert.equal(paid.crypto?.transactionHash, pendingCrypto.hash);
        assert.equal(paid.crypto?.payerVerified, true);
        assert.equal(paid.settlementKind, 'WALLET');
        assert.equal(paid.commissionOwedMinor, '1500000');
        assert.equal(paid.merchantExpectedMinor, '15000000');
        const postings = await rows(
          pool,
          'SELECT p.account_code,p.amount_minor FROM seven.money_postings p JOIN seven.money_journals j USING(money_journal_id) WHERE j.source_reference=$1 ORDER BY p.account_code',
          [`receipt:crypto:84532:${pendingCrypto.hash}`],
        );
        assert.equal(postings.length, 4);
        assert.equal(
          postings.find(
            (posting) => posting.account_code === `commission-receivable:${hostUser.businessId}`,
          )?.amount_minor,
          '1500000',
        );
        assert.equal(
          postings.find(
            (posting) => posting.account_code === `business-direct-crypto:${hostUser.businessId}`,
          )?.amount_minor,
          '-15000000',
        );
        assert.ok(
          postings.every(
            (posting) =>
              !['provider-clearing', `business:${hostUser.businessId}`].includes(
                posting.account_code,
              ),
          ),
        );
        assert.equal(
          postings.reduce((sum, posting) => sum + BigInt(posting.amount_minor), 0n),
          0n,
        );
        assert.equal(
          (
            await one(
              pool,
              'SELECT count(*)::text AS total FROM seven.money_journals WHERE source_reference=$1',
              [`receipt:crypto:84532:${pendingCrypto.hash}`],
            )
          )?.total,
          '1',
        );
      },
    );

    await t.test(
      'another customer cannot inspect, initialize or submit proof for the saved payment',
      async () => {
        assert.ok(pendingCrypto);
        const payment = await guest.request<C.Payment>(
          `/payments/${pendingCrypto.checkout.paymentId}`,
        );
        assert.equal((await friend.request(`/payments/${payment.data.id}`)).status, 403);
        assert.equal(
          (await friend.request(`/reservations/${payment.data.reservationId}/payment-options`))
            .status,
          403,
        );
        assert.equal(
          (
            await friend.request(`/reservations/${payment.data.reservationId}/checkout`, 'POST', {
              method: 'USDC_BASE',
              payerAddress: payer.address,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await friend.request('/payments/verify', 'POST', {
              reference: payment.data.reference,
              transactionId: pendingCrypto.hash,
            })
          ).status,
          403,
        );
        const unchanged = await guest.request<C.Payment>(`/payments/${payment.data.id}`);
        assert.equal(unchanged.data.status, 'PAID');
        assert.equal(unchanged.data.providerTransactionId, payment.data.providerTransactionId);
        assert.equal(
          (await guest.request<C.SessionData>('/auth/session')).data.user?.id,
          guestUser.id,
        );
      },
    );
  } finally {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server?.close((error) => (error ? reject(error) : resolve())),
      );
    if (appPool !== pool) await appPool.end();
    await pool.end();
  }
});
