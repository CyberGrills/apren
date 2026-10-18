import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { privateKeyToAccount } from 'viem/accounts';
import type { SessionUser } from '@7even/contracts';
import { mountPaymentAccounts } from '../../services/platform/src/paymentAccounts.ts';
import {
  buildBusinessWalletMessage,
  MockCryptoGateway,
} from '../../services/platform/src/cryptoProvider.ts';
import { ProviderRegistry } from '../../services/platform/src/providerRegistry.ts';
import { ApiError, fail } from '../../services/platform/src/db.ts';
import type { Connection } from '../../services/platform/src/db.ts';

const businessId = '11111111-1111-4111-8111-111111111111';
const otherBusinessId = '22222222-2222-4222-8222-222222222222';
const owner: SessionUser = {
  id: 'owner',
  role: 'BUSINESS_OWNER',
  businessId,
  venueIds: [],
  email: 'owner@example.test',
  displayName: 'Fixture owner',
};
const admin: SessionUser = { ...owner, id: 'admin', role: 'ADMIN', businessId: null };
const signer = privateKeyToAccount(`0x${'02'.padStart(64, '0')}`);
type Handler = (req: Request, res: Response) => Promise<unknown>;
interface AccountRow {
  business_payment_account_id: string;
  payment_provider_id: number;
  account_code: string;
  account_label: string;
  execution_mode_id: number;
  revision: number;
  workflow_state_code: string;
  verified_at: Date | null;
  details: Record<string, unknown>;
}
function account(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    business_payment_account_id: '33333333-3333-4333-8333-333333333333',
    payment_provider_id: 3,
    account_code: signer.address,
    account_label: 'USDC on Base wallet',
    execution_mode_id: 1,
    revision: 1,
    workflow_state_code: 'PENDING',
    verified_at: null,
    details: {
      ownershipMessage: 'Fixture verified wallet proof',
      ownershipVerifiedAt: new Date().toISOString(),
      chainId: 84532,
    },
    ...overrides,
  };
}

/** A route-level database double. PostgreSQL locking/transactions are covered by the parent API suite. */
function harness(user: SessionUser | null = owner, current?: AccountRow, mutationActor = user) {
  const handlers = new Map<string, Handler>();
  let stored = current;
  const writes: { sql: string; values: unknown[] }[] = [];
  let mutations = 0;
  const database = {
    async query(sql: string, values: unknown[] = []) {
      if (sql.startsWith('SELECT r.*,') && sql.includes('seven.businesses'))
        return {
          rows: [
            {
              business_id: businessId,
              business_name: 'Synthetic business',
              city: 'Lagos',
              details: {},
              description: '',
              state_code: 'APPROVED',
              created_at: new Date(),
              subaccount_id: null,
            },
          ],
        };
      if (sql.startsWith('SELECT a.*,') && sql.includes('business_payment_accounts'))
        return { rows: stored ? [stored] : [] };
      if (sql.startsWith('SELECT coalesce(sum(amount_minor)'))
        return { rows: [{ total: '25000' }] };
      if (sql.startsWith('SELECT business_id')) return { rows: [{ business_id: businessId }] };
      if (sql.startsWith('SELECT * FROM seven.business_payment_accounts'))
        return { rows: stored ? [stored] : [] };
      writes.push({ sql, values });
      if (sql.includes('INSERT INTO seven.business_payment_accounts')) {
        stored = account({
          business_payment_account_id: String(values[0]),
          account_code: String(values[3]),
          account_label: String(values[4]),
          execution_mode_id: Number(values[5]),
          details: values[6] as Record<string, unknown>,
        });
      } else if (sql.includes('UPDATE seven.business_payment_accounts SET account_code=')) {
        assert.ok(stored);
        stored = {
          ...stored,
          account_code: String(values[1]),
          account_label: String(values[2]),
          execution_mode_id: Number(values[3]),
          revision: stored.revision + 1,
          workflow_state_code: 'PENDING',
          verified_at: null,
          details: values[4] as Record<string, unknown>,
        };
      } else if (sql.includes('UPDATE seven.business_payment_accounts SET workflow_state_id=')) {
        assert.ok(stored);
        stored = {
          ...stored,
          workflow_state_code: values[1] ? 'APPROVED' : 'REJECTED',
          revision: stored.revision + 1,
          verified_at: values[1] ? new Date() : null,
          details: { ...stored.details, ...(values[2] as Record<string, unknown>) },
        };
      } else if (
        !sql.includes('INSERT INTO seven.audit_events') &&
        !sql.includes('INSERT INTO seven.outbox_events')
      ) {
        throw new Error(`Unexpected SQL in wallet test: ${sql}`);
      }
      return { rows: [] };
    },
  };
  mountPaymentAccounts({
    route: (method, path, handler) => {
      handlers.set(`${method} ${path}`, handler);
    },
    mutate: async <T>(
      _req: Request,
      _res: Response,
      work: (db: Connection, actor: SessionUser) => Promise<T>,
    ) => {
      mutations++;
      if (!mutationActor) return fail(401, 'AUTHENTICATION_REQUIRED', 'Sign in.');
      return work(database as Connection, mutationActor);
    },
    pool: database as unknown as Pool,
    source: new ProviderRegistry({
      mode: 'mock',
      crypto: new MockCryptoGateway({ chainId: 84532 }),
    }),
    actorFor: () => user ?? fail(401, 'AUTHENTICATION_REQUIRED', 'Sign in.'),
    requireRole: (actor, roles) => {
      if (!roles.includes(actor.role)) fail(403, 'FORBIDDEN', 'Forbidden.');
    },
    id: () => businessId,
  });
  return {
    writes,
    get mutations() {
      return mutations;
    },
    get stored() {
      return stored;
    },
    async call(
      method: string,
      path: string,
      body: unknown = {},
      query: Record<string, unknown> = {},
    ) {
      const handler = handlers.get(`${method} ${path}`);
      assert.ok(handler);
      return handler({ body, query } as Request, {} as Response);
    },
  };
}
async function walletInput(
  expectedRevision = 0,
  expiresAt = new Date(Date.now() + 180_000).toISOString(),
) {
  const message = buildBusinessWalletMessage({
    reference: `business:${businessId}:revision:${expectedRevision}`,
    venueId: businessId,
    chainId: 84532,
    walletAddress: signer.address,
    expiresAt,
  });
  return {
    walletAddress: signer.address,
    signature: await signer.signMessage({ message }),
    expectedRevision,
    expiresAt,
  };
}
const status = (expected: number) => (error: unknown) =>
  error instanceof ApiError && error.status === expected;

test('owner account list includes only their business projection, commission owed and actual gateway network', async () => {
  const result = (await harness(owner, account()).call('get', '/business/payment-accounts')) as {
    accounts: { accountCode: string }[];
    commissionOwedMinor: string;
    chainId: number;
  };
  assert.equal(result.accounts[0]?.accountCode, signer.address);
  assert.equal(result.commissionOwedMinor, '25000');
  assert.equal(result.chainId, 84532);
});

for (const role of ['RECEPTION', 'CUSTOMER', 'ADMIN'] as const) {
  test(`${role} cannot read, challenge or change the business settlement wallet`, async () => {
    const client = harness({ ...owner, role });
    for (const [method, path] of [
      ['get', '/business/payment-accounts'],
      ['get', '/business/payment-wallet-challenge'],
      ['post', '/business/payment-wallet'],
    ] as const)
      await assert.rejects(client.call(method, path), status(403));
    assert.equal(client.writes.length, 0);
  });
}

test('anonymous requests and owners without business membership cannot access wallet routes', async () => {
  await assert.rejects(harness(null).call('get', '/business/payment-accounts'), status(401));
  await assert.rejects(
    harness({ ...owner, businessId: null }).call('get', '/business/payment-accounts'),
    status(403),
  );
});

test('wallet challenge binds the current business, revision, Base chain and expiry', async () => {
  const result = (await harness(owner, account({ revision: 7 })).call(
    'get',
    '/business/payment-wallet-challenge',
    {},
    { address: signer.address },
  )) as { revision: number; expiresAt: string; message: string };
  assert.equal(result.revision, 7);
  assert.match(result.message, new RegExp(`business:${businessId}:revision:7`));
  assert.match(result.message, /84532/);
  assert.ok(Date.parse(result.expiresAt) > Date.now());
  assert.ok(Date.parse(result.expiresAt) <= Date.now() + 300_000);
});

test('wallet challenge rejects a zero address and malformed checksum addresses', async () => {
  for (const address of [
    `0x${'0'.repeat(40)}`,
    'wrong',
    '0x833589fcd6EDb6E08f4c7C32D4f71b54bdA02913',
  ])
    await assert.rejects(
      harness().call('get', '/business/payment-wallet-challenge', {}, { address }),
      status(422),
    );
});

test('a valid EOA proof creates a pending wallet with no signature stored or audited', async () => {
  const client = harness();
  const input = await walletInput();
  await client.call('post', '/business/payment-wallet', input);
  assert.equal(client.stored?.account_code, signer.address);
  assert.equal(client.stored?.workflow_state_code, 'PENDING');
  assert.equal(client.stored?.revision, 1);
  assert.equal(client.stored?.verified_at, null);
  assert.ok(client.stored?.details.ownershipVerifiedAt);
  assert.equal(JSON.stringify(client.writes).includes(input.signature), false);
});

test('a proof signed by a different wallet cannot change the destination', async () => {
  const client = harness();
  const input = await walletInput();
  await assert.rejects(
    client.call('post', '/business/payment-wallet', {
      ...input,
      walletAddress: '0x2222222222222222222222222222222222222222',
    }),
    status(422),
  );
  assert.equal(client.mutations, 0);
});

for (const [label, offset] of [
  ['expired', -60_000],
  ['overlong', 600_000],
] as const) {
  test(`${label} proof cannot update a business wallet`, async () => {
    const client = harness();
    await assert.rejects(
      client.call(
        'post',
        '/business/payment-wallet',
        await walletInput(0, new Date(Date.now() + offset).toISOString()),
      ),
      status(422),
    );
    assert.equal(client.writes.length, 0);
  });
}

test('a stale revision cannot replace a wallet, even with a valid ownership signature', async () => {
  const client = harness(owner, account({ revision: 2 }));
  await assert.rejects(
    client.call('post', '/business/payment-wallet', await walletInput(1)),
    status(409),
  );
  assert.equal(client.stored?.revision, 2);
});

test('changing an approved wallet removes its approval until a new administrator review', async () => {
  const client = harness(
    owner,
    account({ revision: 2, workflow_state_code: 'APPROVED', verified_at: new Date() }),
  );
  await client.call('post', '/business/payment-wallet', await walletInput(2));
  assert.equal(client.stored?.revision, 3);
  assert.equal(client.stored?.workflow_state_code, 'PENDING');
  assert.equal(client.stored?.verified_at, null);
});

test('mutation callbacks recheck owner role and business scope', async () => {
  for (const actor of [
    { ...owner, role: 'RECEPTION' as const },
    { ...owner, businessId: otherBusinessId },
  ]) {
    const client = harness(owner, undefined, actor);
    await assert.rejects(
      client.call('post', '/business/payment-wallet', await walletInput()),
      status(403),
    );
    assert.equal(client.writes.length, 0);
  }
});

test('administrator approval increments the reviewed revision and timestamps verified ownership', async () => {
  const client = harness(admin, account());
  await client.call('post', '/admin/businesses/:id/crypto-wallet/approve', {
    expectedRevision: 1,
    approved: true,
    reason: 'Business destination confirmed',
  });
  assert.equal(client.stored?.workflow_state_code, 'APPROVED');
  assert.equal(client.stored?.revision, 2);
  assert.ok(client.stored?.verified_at);
  assert.equal(client.stored?.details.reviewedBy, admin.id);
});

test('administrator rejection retains the wallet evidence and records the reason', async () => {
  const client = harness(admin, account());
  await client.call('post', '/admin/businesses/:id/crypto-wallet/approve', {
    expectedRevision: 1,
    approved: false,
    reason: 'Business destination was not confirmed',
  });
  assert.equal(client.stored?.workflow_state_code, 'REJECTED');
  assert.equal(client.stored?.revision, 2);
  assert.equal(client.stored?.verified_at, null);
  assert.ok(client.stored?.details.ownershipVerifiedAt);
});

test('administrator can reject an obsolete or incomplete pending wallet without approving it', async () => {
  const client = harness(admin, account({ details: { chainId: 8453 } }));
  await client.call('post', '/admin/businesses/:id/crypto-wallet/approve', {
    expectedRevision: 1,
    approved: false,
    reason: 'Receiving network needs a new submission',
  });
  assert.equal(client.stored?.workflow_state_code, 'REJECTED');
  assert.equal(client.stored?.verified_at, null);
});

test('business owners cannot approve their own receiving wallet', async () => {
  await assert.rejects(
    harness(owner, account()).call('post', '/admin/businesses/:id/crypto-wallet/approve', {}),
    status(403),
  );
});

for (const [label, current, expectedRevision] of [
  ['stale revision', account({ revision: 2 }), 1],
  ['already approved', account({ workflow_state_code: 'APPROVED' }), 1],
  [
    'different chain',
    account({
      details: {
        chainId: 8453,
        ownershipMessage: 'proof',
        ownershipVerifiedAt: new Date().toISOString(),
      },
    }),
    1,
  ],
  ['missing ownership proof', account({ details: { chainId: 84532 } }), 1],
] as const) {
  test(`administrator review rejects ${label}`, async () => {
    const client = harness(admin, current);
    await assert.rejects(
      client.call('post', '/admin/businesses/:id/crypto-wallet/approve', {
        expectedRevision,
        approved: true,
        reason: 'Synthetic review decision',
      }),
      status(409),
    );
    assert.equal(client.writes.length, 0);
  });
}

test('administrator authority is rechecked inside the mutation callback', async () => {
  const client = harness(admin, account(), owner);
  await assert.rejects(
    client.call('post', '/admin/businesses/:id/crypto-wallet/approve', {
      expectedRevision: 1,
      approved: true,
      reason: 'Synthetic review decision',
    }),
    status(403),
  );
  assert.equal(client.writes.length, 0);
});
