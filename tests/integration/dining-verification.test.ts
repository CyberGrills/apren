import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type * as C from '@7even/contracts';
import { createApp } from '../../backend/platform/src/app.ts';
import { createPool, one } from '../../backend/platform/src/db.ts';
import { migrate } from '../../backend/platform/src/migrate.ts';
import { MockProvider } from '../../backend/platform/src/provider.ts';
import { seed } from '../../backend/platform/src/seed.ts';

const origin = 'http://localhost:5177';
const password = 'Dining-Verification-Test-Passphrase-42!';

function disposableUrl(value: string, label: string): URL {
  const parsed = new URL(value);
  assert.doesNotMatch(
    parsed.hostname,
    /(?:^|\\.)supabase\\.co$|(?:^|\\.)pooler\\.supabase\\.com$/i,
    `${label} must point to an isolated test PostgreSQL instance, never Supabase.`,
  );
  assert.match(decodeURIComponent(parsed.pathname.slice(1)), /_test_db$/, `${label} must end in _test_db.`);
  return parsed;
}

interface Result<T> {
  status: number;
  data: T;
  error?: { code: string; message: string };
}

class Client {
  cookie = '';
  csrf = '';
  readonly base: string;

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
    if (cookie) this.cookie = cookie.split(';')[0]!;
    const result = (await response.json()) as { data: T; error?: { code: string; message: string } };
    return { status: response.status, ...result };
  }

  async register(email: string): Promise<C.SessionUser> {
    const result = await this.request<C.SessionData>('/auth/register', 'POST', {
      email,
      password,
      displayName: 'Dining Verification Test',
    });
    assert.equal(result.status, 200, JSON.stringify(result));
    this.csrf = result.data.csrfToken!;
    return result.data.user!;
  }

  async login(email: string): Promise<C.SessionUser> {
    const result = await this.request<C.SessionData>('/auth/login', 'POST', { email, password });
    assert.equal(result.status, 200, JSON.stringify(result));
    this.csrf = result.data.csrfToken!;
    return result.data.user!;
  }
}

test(
  'Dining approval requires evidence and public discovery, quote, and reservation gates fail closed',
  { skip: !process.env.TEST_DATABASE_URL, timeout: 120000 },
  async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL!;
    const parsed = disposableUrl(databaseUrl, 'TEST_DATABASE_URL');
    const pool = createPool(databaseUrl);
    let appPool = pool;
    let ownsAppPool = false;
    let schemaReady = false;
    let server: Server | undefined;
    const userIds: string[] = [];
    const businessIds: string[] = [];
    const offeringIds: string[] = [];
    const quoteIds: string[] = [];

    try {
      const identity = await one<{ db: string }>(pool, 'SELECT current_database() AS db');
      assert.equal(identity?.db, decodeURIComponent(parsed.pathname.slice(1)));
      await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
      await migrate(pool);
      await seed(pool, password);
      schemaReady = true;

      if (process.env.TEST_RUNTIME_DATABASE_URL) {
        const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL;
        const runtimeParsed = disposableUrl(runtimeUrl, 'TEST_RUNTIME_DATABASE_URL');
        assert.equal(decodeURIComponent(runtimeParsed.pathname.slice(1)), identity?.db);
        appPool = createPool(runtimeUrl);
        ownsAppPool = true;
      }
      const runtimeIdentity = await one<{ db: string }>(appPool, 'SELECT current_database() AS db');
      assert.equal(runtimeIdentity?.db, identity?.db);

      const app = createApp({
        pool: appPool,
        provider: new MockProvider(),
        environment: 'test',
        publicOrigin: origin,
      });
      server = await new Promise<Server>((resolve) => {
        const listener = app.app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

      const owner = new Client(base);
      const ownerEmail = `dining-owner-${randomUUID()}@seven.test`;
      const ownerUser = await owner.register(ownerEmail);
      userIds.push(ownerUser.id);
      const application = await owner.request<C.Business>('/business/applications', 'POST', {
        businessName: 'Dining Verification Isolated Fixture',
        city: 'Uyo',
        state: 'Akwa Ibom',
        address: '1 Isolated Test Lane, Uyo',
        phone: '+2348012345678',
        sector: 'DINING',
        description: 'Synthetic integration fixture; not a real restaurant or public listing.',
      });
      assert.equal(application.status, 200, JSON.stringify(application));
      businessIds.push(application.data.id);
      await owner.login(ownerEmail);

      const admin = new Client(base);
      const adminEmail = `dining-admin-${randomUUID()}@seven.test`;
      const adminUser = await admin.register(adminEmail);
      userIds.push(adminUser.id);
      await pool.query(
        "UPDATE seven.users SET role_id=(SELECT role_id FROM seven.roles WHERE role_code='ADMIN') WHERE user_id=$1",
        [adminUser.id],
      );
      await admin.login(adminEmail);

      const approvalPath = `/admin/businesses/${application.data.id}/status`;
      const missingEvidence = await admin.request(approvalPath, 'POST', {
        status: 'APPROVED',
        reason: 'Attempt approval without Dining evidence.',
      });
      assert.equal(missingEvidence.status, 409, JSON.stringify(missingEvidence));
      assert.equal(missingEvidence.error?.code, 'DINING_VERIFICATION_REQUIRED');

      const evidence = { confirmed: true, evidenceReference: 'isolated-test:owner-reviewed-evidence' };
      const diningVerification = {
        businessIdentity: evidence,
        ownerAuthority: evidence,
        physicalVenue: evidence,
        workingContact: evidence,
        ownerApprovedMenu: evidence,
        dishEvidence: evidence,
        currentPricesNgn: evidence,
        openingHours: evidence,
        serviceCapacityAndTerms: evidence,
        photoPermission: evidence,
      };
      const incompleteEvidence = { ...diningVerification };
      delete (incompleteEvidence as Partial<typeof diningVerification>).photoPermission;
      const incompleteApproval = await admin.request(approvalPath, 'POST', {
        status: 'APPROVED',
        reason: 'Attempt approval with a missing evidence item.',
        diningVerification: incompleteEvidence,
      });
      assert.equal(incompleteApproval.status, 422, JSON.stringify(incompleteApproval));

      const approval = await admin.request<C.Business>(approvalPath, 'POST', {
        status: 'APPROVED',
        reason: 'Approved by the isolated Dining verification test.',
        diningVerification,
      });
      assert.equal(approval.status, 200, JSON.stringify(approval));
      assert.equal(approval.data.status, 'APPROVED');

      await owner.login(ownerEmail);
      const offerResponse = await owner.request<C.Offering>('/business/offerings', 'POST', {
        title: 'DINING VERIFICATION FIXTURE — Test sitting',
        description: 'Synthetic test-only Dining offering; no real customer supply.',
        kind: 'DINING',
        city: 'Uyo',
        state: 'Akwa Ibom',
        address: '1 Isolated Test Lane, Uyo',
        priceMinor: '450000',
        capacity: 4,
        published: true,
        images: [],
        amenities: [],
        cancellationHours: 24,
        taxBps: 0,
        discountBps: 0,
      });
      assert.equal(offerResponse.status, 200, JSON.stringify(offerResponse));
      const offeringId = offerResponse.data.id;
      offeringIds.push(offeringId);

      const serviceDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      const availability = await owner.request(
        `/business/offerings/${offeringId}/availability`,
        'POST',
        {
          startDate: serviceDate,
          startAt: `${serviceDate}T18:00:00+01:00`,
          endAt: `${serviceDate}T19:00:00+01:00`,
          capacity: 4,
        },
      );
      assert.equal(availability.status, 200, JSON.stringify(availability));

      const customer = new Client(base);
      const customerEmail = `dining-customer-${randomUUID()}@seven.test`;
      const customerUser = await customer.register(customerEmail);
      userIds.push(customerUser.id);

      const listedWhileVerified = await customer.request<C.Offering[]>(
        '/offerings?kind=DINING&city=Uyo&pageSize=30',
      );
      assert.equal(listedWhileVerified.status, 200, JSON.stringify(listedWhileVerified));
      assert.ok(listedWhileVerified.data.some((item) => item.id === offeringId));

      const detailWhileVerified = await customer.request<C.Offering>(`/offerings/${offeringId}`);
      assert.equal(detailWhileVerified.status, 200, JSON.stringify(detailWhileVerified));

      const validQuote = await customer.request<C.Quote>('/quotes', 'POST', {
        offeringId,
        startDate: serviceDate,
        quantity: 2,
      });
      assert.equal(validQuote.status, 200, JSON.stringify(validQuote));
      quoteIds.push(validQuote.data.id);

      // Simulate evidence withdrawal/revocation after a quote has been issued.
      await pool.query(
        "UPDATE seven.businesses SET details=details-'diningVerificationReview' WHERE business_id=$1",
        [application.data.id],
      );

      const listedAfterRevocation = await customer.request<C.Offering[]>(
        '/offerings?kind=DINING&city=Uyo&pageSize=30',
      );
      assert.equal(listedAfterRevocation.status, 200, JSON.stringify(listedAfterRevocation));
      assert.ok(!listedAfterRevocation.data.some((item) => item.id === offeringId));

      const detailAfterRevocation = await customer.request(
        `/offerings/${offeringId}`,
      );
      assert.equal(detailAfterRevocation.status, 403, JSON.stringify(detailAfterRevocation));

      const quoteAfterRevocation = await customer.request('/quotes', 'POST', {
        offeringId,
        startDate: serviceDate,
        quantity: 1,
      });
      assert.equal(quoteAfterRevocation.status, 409, JSON.stringify(quoteAfterRevocation));
      assert.equal(quoteAfterRevocation.error?.code, 'DINING_VERIFICATION_REQUIRED');

      const reservationAfterRevocation = await customer.request('/reservations', 'POST', {
        quoteId: validQuote.data.id,
      });
      assert.equal(reservationAfterRevocation.status, 409, JSON.stringify(reservationAfterRevocation));
      assert.equal(reservationAfterRevocation.error?.code, 'DINING_VERIFICATION_REQUIRED');
    } finally {
      if (server) {
        await new Promise<void>((resolve, reject) =>
          server!.close((error) => (error ? reject(error) : resolve())),
        );
      }
      if (schemaReady) {
        if (quoteIds.length) {
          await pool.query('DELETE FROM seven.quotes WHERE quote_id=ANY($1::uuid[])', [quoteIds]);
        }
        if (offeringIds.length) {
          await pool.query('DELETE FROM seven.observations WHERE offering_id=ANY($1::uuid[])', [offeringIds]);
          await pool.query('DELETE FROM seven.inventory_windows WHERE offering_id=ANY($1::uuid[])', [offeringIds]);
          await pool.query('DELETE FROM seven.offerings WHERE offering_id=ANY($1::uuid[])', [offeringIds]);
        }
        if (businessIds.length) {
          for (const table of ['outbox_events', 'audit_events', 'sources', 'memberships', 'venues', 'businesses']) {
            await pool.query(`DELETE FROM seven.${table} WHERE business_id=ANY($1::uuid[])`, [businessIds]);
          }
        }
        if (userIds.length) {
          for (const table of ['audit_events', 'idempotencies', 'sessions', 'notifications']) {
            await pool.query(`DELETE FROM seven.${table} WHERE user_id=ANY($1::uuid[])`, [userIds]);
          }
          await pool.query('DELETE FROM seven.users WHERE user_id=ANY($1::uuid[])', [userIds]);
        }
      }
      if (ownsAppPool) await appPool.end();
      await pool.end();
    }
  },
);
