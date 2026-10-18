import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type * as C from '@7even/contracts';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../../services/platform/src/app.ts';
import { MockCryptoGateway } from '../../services/platform/src/cryptoProvider.ts';
import type {
  CryptoGateway,
  CryptoPrepareInput,
  CryptoQuoteData,
  CryptoTransferEvidence,
  CryptoTransferIntent,
} from '../../services/platform/src/cryptoProvider.ts';
import { createPool, one, rows } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { ProviderRegistry } from '../../services/platform/src/providerRegistry.ts';
import { seed } from '../../services/platform/src/seed.ts';

const origin = 'http://localhost:5177';
const password = 'Isolated-boundary-regression-fixture-42!';
interface Result<T> {
  status: number;
  data: T;
  error?: { code: string; message: string };
}
class Client {
  readonly base: string;
  cookie = '';
  csrf = '';
  constructor(base: string) {
    this.base = base;
  }
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<Result<T>> {
    const response = await fetch(`${this.base}/api${path}`, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: this.cookie,
        'X-CSRF-Token': this.csrf,
        'Idempotency-Key': randomUUID(),
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
    assert.ok(result.data.user && result.data.csrfToken);
    this.csrf = result.data.csrfToken;
    return result.data.user;
  }
  on(base: string): Client {
    const client = new Client(base);
    client.cookie = this.cookie;
    client.csrf = this.csrf;
    return client;
  }
}

/** Finalized chain evidence double, not an RPC or real funds. The real gateway has separate RPC tests. */
class FinalizedGateway implements CryptoGateway {
  readonly mode = 'crypto' as const;
  readonly enabled = true;
  readonly chainId = 84532;
  private readonly quotes = new MockCryptoGateway();
  private readonly transfers = new Map<string, CryptoTransferEvidence>();
  prepare(input: CryptoPrepareInput) {
    return this.quotes.prepare(input);
  }
  verifySignature(quote: CryptoQuoteData, signature: string) {
    return this.quotes.verifySignature(quote, signature);
  }
  record(
    intent: CryptoTransferIntent,
    hash = `0x${randomUUID().replaceAll('-', '').repeat(2)}`,
  ): string {
    this.transfers.set(hash, {
      status: 'successful',
      transactionId: hash,
      amountAtoms: intent.amountAtoms,
      from: intent.payerAddress,
      to: intent.recipientAddress,
      blockNumber: (BigInt(intent.anchorBlock) + 1n).toString(),
      blockHash: `0x${'d'.repeat(64)}`,
      includedAt: new Date().toISOString(),
      chainId: intent.chainId,
      tokenAddress: intent.tokenAddress,
    });
    return hash;
  }
  verify(quote: CryptoQuoteData, hash: string) {
    return this.evidence(quote, hash);
  }
  verifyReturn(intent: CryptoTransferIntent, hash: string) {
    return this.evidence(intent, hash);
  }
  private evidence(intent: CryptoTransferIntent, hash: string): Promise<CryptoTransferEvidence> {
    const transfer = this.transfers.get(hash);
    if (!transfer) throw new Error('The synthetic finalized transfer was not recorded.');
    assert.equal(transfer.from.toLowerCase(), intent.payerAddress.toLowerCase());
    assert.equal(transfer.to.toLowerCase(), intent.recipientAddress.toLowerCase());
    assert.equal(transfer.amountAtoms, intent.amountAtoms);
    assert.equal(transfer.chainId, intent.chainId);
    assert.equal(transfer.tokenAddress.toLowerCase(), intent.tokenAddress.toLowerCase());
    return Promise.resolve({ ...transfer });
  }
}

test('payment mode, wallet network, refund and recovery boundaries in isolated PostgreSQL', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 120000,
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
  assert.deepEqual(
    target(ownerUrl),
    target(runtimeUrl),
    'Owner and runtime must select the same isolated test server, socket and database.',
  );
  const pool = createPool(ownerUrl);
  const appPool = runtimeUrl === ownerUrl ? pool : createPool(runtimeUrl);
  const servers: Server[] = [];
  try {
    const identity =
      'SELECT current_database() AS name,inet_server_addr()::text AS address,inet_server_port() AS port';
    const ownerIdentity = await one(pool, identity);
    assert.match(
      String(ownerIdentity?.name),
      /_test_db$/,
      'A development or production database must never be reset.',
    );
    assert.deepEqual(
      await one(appPool, identity),
      ownerIdentity,
      'Owner and runtime database/server identities must match before any reset.',
    );
    await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
    await migrate(pool);
    await seed(pool, password);
    const crypto = new MockCryptoGateway();
    const providers = new ProviderRegistry({
      mode: 'mock',
      adapters: { flutterwave: new MockProvider(), paystack: new MockProvider() },
      crypto,
    });
    async function start(registry: ProviderRegistry) {
      const runtime = createApp({
        pool: appPool,
        providers: registry,
        environment: 'test',
        publicOrigin: origin,
      });
      const server = await new Promise<Server>((resolve) => {
        const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      servers.push(server);
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }
    const base = await start(providers);
    const guest = new Client(base),
      host = new Client(base),
      admin = new Client(base),
      reception = new Client(base);
    const guestUser = await guest.login('guest@seven.test');
    const hostUser = await host.login('host@seven.test');
    assert.ok(hostUser.businessId);
    const businessId = hostUser.businessId;
    await admin.login('admin@seven.test');
    await reception.login('reception@seven.test');
    const payer = privateKeyToAccount(generatePrivateKey());
    const merchant = privateKeyToAccount(generatePrivateKey());
    const liveGateway = new FinalizedGateway();
    const liveProviders = new ProviderRegistry({ mode: 'live', adapters: {}, crypto: liveGateway });
    const liveBase = await start(liveProviders);
    const liveGuest = guest.on(liveBase),
      liveHost = host.on(liveBase);

    async function hold(client: Client = guest): Promise<C.Reservation> {
      const offering = await host.request<C.Offering>('/business/offerings', 'POST', {
        title: 'Isolated payment boundary stay',
        description: 'Synthetic stay used only for payment boundary regression checks.',
        kind: 'STAY',
        city: 'Lagos',
        address: 'Isolated test venue, Lagos',
        priceMinor: '15000000',
        capacity: 20,
        published: true,
      });
      assert.equal(offering.status, 200, JSON.stringify(offering));
      await pool.query('UPDATE seven.offerings SET tax_bps=0 WHERE offering_id=$1', [
        offering.data.id,
      ]);
      const startDate = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
      const endDate = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
      const availability = await host.request(
        `/business/offerings/${offering.data.id}/availability`,
        'POST',
        { startDate, endDate, capacity: 20 },
      );
      assert.equal(availability.status, 200, JSON.stringify(availability));
      const quote = await client.request<C.Quote>('/quotes', 'POST', {
        offeringId: offering.data.id,
        startDate,
        endDate,
        quantity: 1,
      });
      assert.equal(quote.status, 200, JSON.stringify(quote));
      const held = await client.request<C.Reservation>('/reservations', 'POST', {
        quoteId: quote.data.id,
      });
      assert.equal(held.status, 200, JSON.stringify(held));
      return held.data;
    }
    async function checkout(client: Client, reservation: C.Reservation, address = payer.address) {
      const created = await client.request<C.Checkout>(
        `/reservations/${reservation.id}/checkout`,
        'POST',
        { method: 'USDC_BASE', payerAddress: address },
      );
      assert.equal(created.status, 200, JSON.stringify(created));
      const payment = await client.request<C.Payment>(`/payments/${created.data.paymentId}`);
      assert.equal(payment.status, 200, JSON.stringify(payment));
      assert.ok(payment.data.crypto);
      return payment.data;
    }
    async function paidMock() {
      const reservation = await hold();
      const payment = await checkout(guest, reservation);
      const result = await guest.request<C.Payment>(
        `/payments/${payment.id}/dev-complete`,
        'POST',
        { outcome: 'SUCCESS' },
      );
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(result.data.status, 'PAID');
      return { reservation, payment: result.data };
    }
    async function cancelAndRequest(client: Client, reservation: C.Reservation) {
      const current = await client.request<C.Reservation>(`/reservations/${reservation.id}`);
      assert.equal(current.status, 200, JSON.stringify(current));
      if (current.data.status !== 'FULFILLED') {
        const cancelled = await client.request<C.Reservation>(
          `/reservations/${reservation.id}/actions`,
          'POST',
          { action: 'CANCEL', expectedRevision: current.data.revision },
        );
        assert.equal(cancelled.status, 200, JSON.stringify(cancelled));
      }
      const refund = await client.request<C.Payment>(
        `/reservations/${reservation.id}/refunds`,
        'POST',
        { reason: 'Isolated synthetic return acceptance fixture' },
      );
      assert.equal(refund.status, 200, JSON.stringify(refund));
      assert.equal(refund.data.status, 'REFUND_PENDING');
      assert.ok(refund.data.crypto?.refund);
      return refund.data;
    }
    async function accountMode(mode: number, address?: string) {
      await pool.query(
        `UPDATE seven.business_payment_accounts SET execution_mode_id=$2,
        account_code=coalesce($3,account_code),revision=revision+1 WHERE business_id=$1 AND payment_provider_id=3`,
        [businessId, mode, address ?? null],
      );
    }

    await t.test(
      'verified direct return reverses commission once and preserves a points shortfall after reward spending',
      async () => {
        const before = await guest.request<C.CustomerOverview>('/me/overview');
        const fixture = await paidMock();
        const confirmed = await host.request<C.Reservation>(
          `/reservations/${fixture.reservation.id}`,
        );
        const completed = await host.request<C.Reservation>(
          `/reservations/${fixture.reservation.id}/actions`,
          'POST',
          { action: 'FULFILL', expectedRevision: confirmed.data.revision },
        );
        assert.equal(completed.status, 200, JSON.stringify(completed));
        const earned = await guest.request<C.CustomerOverview>('/me/overview');
        const earnedPoints = earned.data.points.balance - before.data.points.balance;
        assert.ok(earnedPoints > 0);
        const reward = await host.request<C.Reward>('/business/rewards', 'POST', {
          title: 'Isolated full points benefit',
          description: 'Disposable benefit used only in the isolated regression database.',
          pointsCost: earned.data.points.available,
          capacity: 1,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          transferable: false,
          published: true,
        });
        assert.equal(reward.status, 200, JSON.stringify(reward));
        assert.equal(
          (await guest.request(`/rewards/${reward.data.id}/redeem`, 'POST', {})).status,
          200,
        );
        const pending = await cancelAndRequest(host, completed.data);
        assert.equal(pending.commissionOwedMinor, fixture.payment.commissionMinor);
        const refunded = await host.request<C.Payment>(
          `/payments/${fixture.payment.id}/dev-refund-complete`,
          'POST',
          {},
        );
        assert.equal(refunded.status, 200, JSON.stringify(refunded));
        assert.equal(refunded.data.status, 'REFUNDED');
        assert.equal(refunded.data.crypto?.refund?.status, 'DELIVERED');
        assert.equal(refunded.data.commissionOwedMinor, '0');
        const repeat = await host.request<C.Payment>(
          `/payments/${fixture.payment.id}/dev-refund-complete`,
          'POST',
          {},
        );
        assert.equal(repeat.status, 200, JSON.stringify(repeat));
        assert.equal(repeat.data.status, 'REFUNDED');
        const after = await guest.request<C.CustomerOverview>('/me/overview');
        assert.equal(after.data.points.balance, -earnedPoints);
        assert.equal(after.data.points.shortfall, earnedPoints);
        assert.equal(after.data.points.available, 0);
        assert.equal(
          (
            await one(
              pool,
              'SELECT coalesce(sum(amount_minor),0)::text AS total FROM seven.money_postings WHERE account_code=$1',
              [`commission-receivable:${businessId}`],
            )
          )?.total,
          '0',
        );
        const refund = refunded.data.crypto?.refund;
        assert.ok(refund);
        assert.equal(
          (
            await one(
              pool,
              'SELECT count(*)::text AS total FROM seven.money_journals WHERE source_reference=$1',
              [`refund:${refund.id}`],
            )
          )?.total,
          '1',
        );
        assert.equal(
          (
            await one(
              pool,
              'SELECT count(*)::text AS total FROM seven.crypto_refund_proofs WHERE refund_id=$1',
              [refund.id],
            )
          )?.total,
          '1',
        );
      },
    );

    await t.test(
      'a retained live-mode refund cannot be completed through the mock execution path',
      async () => {
        await accountMode(4, merchant.address);
        try {
          const reservation = await hold(liveGuest);
          const payment = await checkout(liveGuest, reservation);
          assert.ok(payment.crypto);
          const resume = await guest.request(`/payments/${payment.id}/checkout`);
          assert.equal(resume.status, 409, JSON.stringify(resume));
          assert.equal(resume.error?.code, 'PROVIDER_MODE_CHANGED');
          const hash = liveGateway.record(payment.crypto.quote);
          const result = await liveGuest.request<C.Payment>('/payments/verify', 'POST', {
            reference: payment.reference,
            transactionId: hash,
            walletSignature: await payer.signMessage({ message: payment.crypto.quote.message }),
          });
          assert.equal(result.status, 200, JSON.stringify(result));
          assert.equal(result.data.mode, 'crypto');
          assert.equal(result.data.status, 'PAID');
          const refund = await cancelAndRequest(liveHost, reservation);
          const wrongMode = await host.request(
            `/payments/${payment.id}/dev-refund-complete`,
            'POST',
            {},
          );
          assert.equal(wrongMode.status, 409, JSON.stringify(wrongMode));
          assert.equal(wrongMode.error?.code, 'PROVIDER_MODE_CHANGED');
          const retained = await host.request<C.Payment>(`/payments/${payment.id}`);
          assert.equal(retained.data.status, 'REFUND_PENDING');
          assert.equal(retained.data.crypto?.refund?.transactionHash, null);
          assert.equal(
            (
              await one(
                pool,
                'SELECT count(*)::text AS total FROM seven.money_journals WHERE source_reference=$1',
                [`refund:${refund.crypto?.refund?.id}`],
              )
            )?.total,
            '0',
          );
        } finally {
          await accountMode(1);
        }
      },
    );

    await t.test(
      'a wallet approved on Sepolia cannot silently activate checkout on Base mainnet',
      async () => {
        const reservation = await hold();
        providers.crypto = new MockCryptoGateway({ chainId: 8453 });
        try {
          const options = await guest.request<C.PaymentOptions>(
            `/reservations/${reservation.id}/payment-options`,
          );
          assert.equal(options.status, 200, JSON.stringify(options));
          assert.equal(options.data.crypto.chainId, 8453);
          assert.equal(options.data.crypto.available, false);
          const denied = await guest.request(`/reservations/${reservation.id}/checkout`, 'POST', {
            method: 'USDC_BASE',
            payerAddress: payer.address,
          });
          assert.equal(denied.status, 409, JSON.stringify(denied));
          assert.equal(denied.error?.code, 'PAYMENTS_UNAVAILABLE');
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
        } finally {
          providers.crypto = crypto;
        }
      },
    );

    await t.test(
      'reception cannot obtain provider destinations or commission owed through its overview',
      async () => {
        const staff = await reception.request<C.ReceptionOverview>('/reception/overview');
        assert.equal(staff.status, 200, JSON.stringify(staff));
        assert.ok(staff.data.business);
        assert.equal(Object.hasOwn(staff.data.business, 'paymentAccounts'), false);
        assert.equal(Object.hasOwn(staff.data.business, 'cryptoCommissionOwedMinor'), false);
        assert.equal((await reception.request('/business/payment-accounts')).status, 403);
        const business = await host.request<C.BusinessOverview>('/business/overview');
        assert.ok(business.data.business?.paymentAccounts?.length);
        assert.equal(typeof business.data.business?.cryptoCommissionOwedMinor, 'string');
      },
    );

    await t.test(
      'verification and return recovery caps create visible admin exceptions without another transfer',
      async () => {
        const reservation = await hold();
        const pendingPayment = await checkout(guest, reservation);
        const refundable = await paidMock();
        const pendingRefund = await cancelAndRequest(host, refundable.reservation);
        assert.ok(pendingRefund.crypto?.refund);
        await pool.query(
          'UPDATE seven.payment_attempts SET provider_details=provider_details||\'{"verificationChecks":120}\'::jsonb WHERE payment_attempt_id=$1',
          [pendingPayment.id],
        );
        await pool.query(
          'UPDATE seven.refunds SET provider_details=provider_details||\'{"recoveryChecks":120}\'::jsonb WHERE refund_id=$1',
          [pendingRefund.crypto.refund.id],
        );
        const before = (await one(pool, 'SELECT count(*)::text AS total FROM seven.money_journals'))
          ?.total;
        const result = await admin.request('/admin/reconcile', 'POST', {});
        assert.equal(result.status, 200, JSON.stringify(result));
        const payment = await guest.request<C.Payment>(`/payments/${pendingPayment.id}`);
        const refund = await host.request<C.Payment>(`/payments/${refundable.payment.id}`);
        assert.equal(payment.data.status, 'UNKNOWN');
        assert.equal(refund.data.crypto?.refund?.status, 'UNKNOWN');
        assert.equal(payment.data.providerTransactionId, null);
        assert.equal(refund.data.crypto?.refund?.transactionHash, null);
        const overview = await admin.request<C.AdminOverview>('/admin/overview');
        assert.ok(
          overview.data.exceptions.some(
            (item) => item.id === pendingPayment.id && item.kind === 'PAYMENT',
          ),
        );
        assert.ok(
          overview.data.exceptions.some(
            (item) => item.id === pendingRefund.crypto?.refund?.id && item.kind === 'REFUND',
          ),
        );
        assert.equal(
          (await one(pool, 'SELECT count(*)::text AS total FROM seven.money_journals'))?.total,
          before,
        );
      },
    );

    await t.test(
      'one finalized transfer cannot concurrently fund a payment and deliver a refund',
      async () => {
        await accountMode(4, merchant.address);
        try {
          const originalReservation = await hold(liveGuest);
          const original = await checkout(liveGuest, originalReservation);
          assert.ok(original.crypto);
          const originalHash = liveGateway.record(original.crypto.quote);
          const paid = await liveGuest.request<C.Payment>('/payments/verify', 'POST', {
            reference: original.reference,
            transactionId: originalHash,
            walletSignature: await payer.signMessage({ message: original.crypto.quote.message }),
          });
          assert.equal(paid.status, 200, JSON.stringify(paid));
          const returning = await cancelAndRequest(liveHost, originalReservation);
          assert.ok(returning.crypto?.refund);
          // A later approved destination equals the earlier customer's wallet. Both obligations
          // legitimately describe the same merchant-to-customer transfer; they must not both claim it.
          await accountMode(4, payer.address);
          const nextReservation = await hold(liveGuest);
          const next = await checkout(liveGuest, nextReservation, merchant.address);
          assert.ok(next.crypto);
          assert.equal(
            next.crypto.quote.payerAddress.toLowerCase(),
            original.crypto.quote.recipientAddress.toLowerCase(),
          );
          assert.equal(
            next.crypto.quote.recipientAddress.toLowerCase(),
            original.crypto.quote.payerAddress.toLowerCase(),
          );
          assert.equal(next.crypto.quote.amountAtoms, returning.crypto.refund.amountAtoms);
          const sharedHash = liveGateway.record(next.crypto.quote);
          const identity = `${next.crypto.quote.chainId}:${sharedHash}`;
          const lockKey = `crypto-transfer:${identity}`;
          const guard = await pool.connect();
          let work: Promise<[Result<C.Payment>, Result<C.Payment>]> | undefined;
          try {
            await guard.query('BEGIN');
            await guard.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [lockKey]);
            work = Promise.all([
              liveGuest.request<C.Payment>('/payments/verify', 'POST', {
                reference: next.reference,
                transactionId: sharedHash,
                walletSignature: await merchant.signMessage({ message: next.crypto.quote.message }),
              }),
              liveHost.request<C.Payment>(`/payments/${original.id}/crypto-refund`, 'POST', {
                transactionHash: sharedHash,
              }),
            ]);
            let waiting = 0;
            for (let attempt = 0; waiting < 2 && attempt < 100; attempt++) {
              waiting = Number(
                (
                  await one(
                    pool,
                    `SELECT count(*) AS total FROM pg_locks
              WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())
              AND classid=((hashtextextended($1,0)>>32)&4294967295)::oid
              AND objid=(hashtextextended($1,0)&4294967295)::oid AND objsubid=1`,
                    [lockKey],
                  )
                )?.total ?? 0,
              );
              if (waiting < 2) await new Promise((resolve) => setTimeout(resolve, 10));
            }
            assert.equal(
              waiting,
              2,
              'Both financial effects must acquire the same transfer claim lock.',
            );
            assert.equal(
              (
                await one(
                  pool,
                  'SELECT count(*)::text AS total FROM seven.money_journals WHERE source_reference=$1',
                  [`receipt:crypto:${identity}`],
                )
              )?.total,
              '0',
            );
          } finally {
            await guard.query('COMMIT');
            guard.release();
          }
          assert.ok(work);
          const outcomes = await work;
          assert.equal(
            outcomes.filter((result) => result.status === 200).length,
            1,
            JSON.stringify(outcomes),
          );
          assert.equal(
            outcomes.filter(
              (result) => result.status === 409 && result.error?.code === 'TRANSFER_REUSED',
            ).length,
            1,
            JSON.stringify(outcomes),
          );
          const claimed = await one(
            pool,
            `SELECT
          (SELECT count(*) FROM seven.payment_attempts WHERE payment_provider_id=3 AND provider_transaction_id=$1)+
          (SELECT count(*) FROM seven.refunds WHERE payment_provider_id=3 AND provider_refund_id=$1) AS total`,
            [identity],
          );
          assert.equal(Number(claimed?.total), 1);
        } finally {
          await accountMode(1);
        }
      },
    );

    await t.test(
      'concurrent wallet submissions and administrator decisions each advance one reviewed revision',
      async () => {
        const challenge = await host.request<{
          message: string;
          revision: number;
          expiresAt: string;
        }>(`/business/payment-wallet-challenge?address=${merchant.address}`);
        assert.equal(challenge.status, 200, JSON.stringify(challenge));
        const input = {
          walletAddress: merchant.address,
          signature: await merchant.signMessage({ message: challenge.data.message }),
          expectedRevision: challenge.data.revision,
          expiresAt: challenge.data.expiresAt,
        };
        const submissions = await Promise.all(
          Array.from({ length: 10 }, () =>
            host.request<C.Business>('/business/payment-wallet', 'POST', input),
          ),
        );
        assert.equal(
          submissions.filter((result) => result.status === 200).length,
          1,
          JSON.stringify(submissions),
        );
        assert.equal(
          submissions.filter(
            (result) => result.status === 409 && result.error?.code === 'REVISION_CONFLICT',
          ).length,
          9,
          JSON.stringify(submissions),
        );
        const current = submissions
          .find((result) => result.status === 200)
          ?.data.paymentAccounts?.find((item) => item.provider === 'crypto');
        assert.ok(current);
        assert.equal(current.revision, challenge.data.revision + 1);
        assert.equal(current.status, 'PENDING');
        assert.equal(current.verifiedAt, null);
        const decisions = await Promise.all(
          Array.from({ length: 10 }, () =>
            admin.request<C.Business>(
              `/admin/businesses/${businessId}/crypto-wallet/approve`,
              'POST',
              {
                expectedRevision: current.revision,
                approved: true,
                reason: 'Isolated signed receiving wallet ownership confirmed',
              },
            ),
          ),
        );
        assert.equal(
          decisions.filter((result) => result.status === 200).length,
          1,
          JSON.stringify(decisions),
        );
        assert.equal(
          decisions.filter(
            (result) => result.status === 409 && result.error?.code === 'REVISION_CONFLICT',
          ).length,
          9,
          JSON.stringify(decisions),
        );
        const approved = decisions
          .find((result) => result.status === 200)
          ?.data.paymentAccounts?.find((item) => item.provider === 'crypto');
        assert.ok(approved);
        assert.equal(approved.revision, current.revision + 1);
        assert.equal(approved.status, 'APPROVED');
        assert.equal(approved.accountCode.toLowerCase(), merchant.address.toLowerCase());
        assert.ok(approved.verifiedAt);
      },
    );

    assert.deepEqual(
      await rows(
        pool,
        'SELECT money_journal_id FROM seven.money_postings GROUP BY money_journal_id HAVING sum(amount_minor)<>0',
      ),
      [],
    );
    assert.deepEqual(
      await rows(
        pool,
        'SELECT points_journal_id FROM seven.points_postings GROUP BY points_journal_id HAVING sum(points)<>0',
      ),
      [],
    );
    assert.equal((await guest.request<C.SessionData>('/auth/session')).data.user?.id, guestUser.id);
  } finally {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
    );
    if (appPool !== pool) await appPool.end();
    await pool.end();
  }
});
