import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type * as C from '@7even/contracts';
import { createApp } from '../../services/platform/src/app.ts';
import { createPool, one } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { seed } from '../../services/platform/src/seed.ts';

const origin = 'http://localhost:5177';
const password = 'HotelReadiness-Test-Passphrase-42!';

function assertDisposableDatabaseUrl(value: string, label: string): URL {
  const parsed = new URL(value);
  assert.doesNotMatch(
    parsed.hostname,
    /(?:^|\.)supabase\.co$|(?:^|\.)pooler\.supabase\.com$/i,
    `${label} must point to an isolated test PostgreSQL instance, never Supabase.`,
  );
  assert.match(
    decodeURIComponent(parsed.pathname.slice(1)),
    /_test_db$/,
    `${label} database name must end in _test_db.`,
  );
  return parsed;
}

function lagosDateOffset(days: number): string {
  const value = new Date(Date.now() + days * 86400000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (name: string) => parts.find((entry) => entry.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function calendarDateOffset(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

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

  async request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<Result<T>> {
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
    const result = (await response.json()) as {
      data: T;
      error?: { code: string; message: string };
    };
    return { status: response.status, ...result };
  }

  async register(email: string): Promise<C.SessionUser> {
    const result = await this.request<C.SessionData>('/auth/register', 'POST', {
      email,
      password,
      displayName: 'Inventory Readiness Test',
    });
    assert.equal(result.status, 200, JSON.stringify(result));
    this.csrf = result.data.csrfToken!;
    return result.data.user!;
  }

  async login(email: string): Promise<C.SessionUser> {
    const result = await this.request<C.SessionData>('/auth/login', 'POST', {
      email,
      password,
    });
    assert.equal(result.status, 200, JSON.stringify(result));
    this.csrf = result.data.csrfToken!;
    return result.data.user!;
  }
}

test(
  'hotel onboarding, admin approval, and room-night inventory eligibility are safe and fail closed',
  { skip: !process.env.TEST_DATABASE_URL, timeout: 120000 },
  async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL!;
    const parsedTestUrl = assertDisposableDatabaseUrl(testDatabaseUrl, 'TEST_DATABASE_URL');
    const pool = createPool(testDatabaseUrl);
    let appPool = pool;
    let ownsAppPool = false;
    let schemaReady = false;
    let server: Server | undefined;
    const testUserIds: string[] = [];
    let pendingBusinessId: string | undefined;
    const offeringIds: string[] = [];

    try {
      const dbName = await one<{ db: string }>(pool, 'SELECT current_database() AS db');
      assert.equal(
        dbName?.db,
        decodeURIComponent(parsedTestUrl.pathname.slice(1)),
        'Connected database must match the explicitly configured TEST_DATABASE_URL.',
      );
      assert.match(dbName?.db ?? '', /_test_db$/, 'Refusing to run against a non-test database.');

      await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
      await migrate(pool);
      await seed(pool, password);
      schemaReady = true;

      if (process.env.TEST_RUNTIME_DATABASE_URL) {
        const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL;
        const parsedRuntimeUrl = assertDisposableDatabaseUrl(runtimeUrl, 'TEST_RUNTIME_DATABASE_URL');
        assert.equal(
          decodeURIComponent(parsedRuntimeUrl.pathname.slice(1)),
          dbName?.db,
          'TEST_RUNTIME_DATABASE_URL must target the same isolated test database.',
        );
        appPool = createPool(runtimeUrl);
        ownsAppPool = true;
      }

      const runtimeDb = await one<{ db: string }>(appPool, 'SELECT current_database() AS db');
      assert.equal(runtimeDb?.db, dbName?.db, 'Application pool must remain inside the test database.');

      const app = createApp({
        pool: appPool,
        provider: new MockProvider(),
        environment: 'test',
        publicOrigin: origin,
      });
      server = await new Promise<Server>((resolve) => {
        const listener = app.app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      const serverAddress = server.address() as AddressInfo;
      const client = new Client(`http://127.0.0.1:${serverAddress.port}`);
      const email = `inventory-readiness-${randomUUID()}@seven.test`;
      const user = await client.register(email);
      testUserIds.push(user.id);

      const admin = new Client(`http://127.0.0.1:${serverAddress.port}`);
      const adminEmail = `inventory-readiness-admin-${randomUUID()}@seven.test`;
      const adminUser = await admin.register(adminEmail);
      testUserIds.push(adminUser.id);
      // Bootstrap the administrator only inside the disposable test schema.
      await pool.query(
        "UPDATE seven.users SET role_id=(SELECT role_id FROM seven.roles WHERE role_code='ADMIN') WHERE user_id=$1",
        [adminUser.id],
      );
      await admin.login(adminEmail);

      const application = await client.request<C.Business>('/business/applications', 'POST', {
        businessName: 'Inventory Readiness Test Property',
        city: 'Readiness Test City',
        address: '1 Isolated Test Lane, Readiness Test City',
        phone: '+2348012345678',
        sector: 'STAY',
        description: 'A disposable integration fixture; not a real hotel or public listing.',
      });
      assert.equal(application.status, 200, JSON.stringify(application));
      assert.equal(application.data.status, 'PENDING');
      pendingBusinessId = application.data.id;

      const refreshedUser = await client.login(email);
      assert.equal(refreshedUser.role, 'BUSINESS_OWNER');
      assert.equal(refreshedUser.businessId, pendingBusinessId);

      const attemptToPublish = await client.request('/business/offerings', 'POST', {
        title: 'Attempted unapproved stay',
        description: 'This synthetic listing must remain unavailable before approval.',
        kind: 'STAY',
        city: 'Readiness Test City',
        address: '1 Isolated Test Lane, Readiness Test City',
        priceMinor: '12000000',
        capacity: 2,
        published: true,
        images: [],
        amenities: [],
        cancellationHours: 24,
        taxBps: 0,
        discountBps: 0,
      });
      assert.equal(attemptToPublish.status, 403, JSON.stringify(attemptToPublish));
      assert.equal(attemptToPublish.error?.code, 'APPROVAL_REQUIRED');

      const unauthorizedApproval = await client.request(
        `/admin/businesses/${pendingBusinessId}/status`,
        'POST',
        { status: 'APPROVED', reason: 'This request must be rejected for a non-admin.' },
      );
      assert.equal(unauthorizedApproval.status, 403, JSON.stringify(unauthorizedApproval));

      const approvalPath = `/admin/businesses/${pendingBusinessId}/status`;
      const missingVerification = await admin.request(
        approvalPath,
        'POST',
        { status: 'APPROVED', reason: 'Attempt approval without evidence.' },
      );
      assert.equal(missingVerification.status, 409, JSON.stringify(missingVerification));
      assert.equal(missingVerification.error?.code, 'VERIFICATION_REQUIRED');

      const verification = {
        propertyExists: { confirmed: true, evidenceReference: 'test-case:property-operating' },
        partnerAuthority: { confirmed: true, evidenceReference: 'test-case:partner-authority' },
        directContact: { confirmed: true, evidenceReference: 'test-case:contact-check' },
        fullAddress: { confirmed: true, evidenceReference: 'test-case:address-check' },
        coordinates: { confirmed: true, evidenceReference: 'test-case:coordinate-check' },
        currentRates: { confirmed: true, evidenceReference: 'test-case:current-rate-sheet' },
        roomInventoryAndPolicies: { confirmed: true, evidenceReference: 'test-case:room-inventory-policy' },
        inventoryFreshnessHours: 24,
      };
      const incompleteVerification = await admin.request(
        approvalPath,
        'POST',
        {
          status: 'APPROVED',
          reason: 'Attempt approval with an unchecked evidence item.',
          verification: {
            ...verification,
            coordinates: { confirmed: false, evidenceReference: 'test-case:coordinate-check' },
          },
        },
      );
      assert.equal(incompleteVerification.status, 409, JSON.stringify(incompleteVerification));
      assert.equal(incompleteVerification.error?.code, 'VERIFICATION_INCOMPLETE');

      const approval = await admin.request<C.Business>(
        approvalPath,
        'POST',
        {
          status: 'APPROVED',
          reason: 'Approved by the isolated inventory readiness test.',
          verification,
        },
      );
      assert.equal(approval.status, 200, JSON.stringify(approval));
      assert.equal(approval.data.status, 'APPROVED');

      await client.login(email);

      const checkIn = lagosDateOffset(7);
      const checkOut = calendarDateOffset(checkIn, 2);
      const fixtureCity = 'Readiness Test City';
      const address = '1 Isolated Test Lane, Readiness Test City';
      const eligibleTitle = 'READINESS FIXTURE - Full two-night capacity';

      async function addOffer(
        title: string,
        capacity: number,
        published = true,
      ): Promise<string> {
        const response = await client.request<C.Offering>('/business/offerings', 'POST', {
          title,
          description: 'Synthetic test-only listing used to verify public eligibility.',
          kind: 'STAY',
          city: fixtureCity,
          address,
          priceMinor: '12000000',
          capacity,
          published,
          images: [],
          amenities: [],
          cancellationHours: 24,
          taxBps: 0,
          discountBps: 0,
        });
        assert.equal(response.status, 200, JSON.stringify(response));
        offeringIds.push(response.data.id);
        return response.data.id;
      }

      async function addAvailability(
        offeringId: string,
        startDate: string,
        endDate: string,
        capacity: number,
      ): Promise<void> {
        const response = await client.request<C.Offering>(
          `/business/offerings/${offeringId}/availability`,
          'POST',
          { startDate, endDate, capacity },
        );
        assert.equal(response.status, 200, JSON.stringify(response));
      }

      const validId = await addOffer(eligibleTitle, 2);
      await addOffer('READINESS FIXTURE - No inventory', 2);
      const partialId = await addOffer('READINESS FIXTURE - Missing second night', 2);
      const lowCapacityId = await addOffer('READINESS FIXTURE - Only one room', 1);
      const unpublishedId = await addOffer('READINESS FIXTURE - Unpublished', 2, false);
      const staleId = await addOffer('READINESS FIXTURE - Stale inventory', 2);

      await addAvailability(validId, checkIn, checkOut, 2);
      await addAvailability(partialId, checkIn, calendarDateOffset(checkIn, 1), 2);
      await addAvailability(lowCapacityId, checkIn, checkOut, 1);
      await addAvailability(unpublishedId, checkIn, checkOut, 2);
      await addAvailability(staleId, checkIn, checkOut, 2);
      await pool.query(
        "UPDATE seven.inventory_windows SET inventory_confirmed_at=now()-interval '25 hours' WHERE offering_id=$1",
        [staleId],
      );

      const listingResponse = await client.request<Array<{ title: string }>>(
        `/offerings?kind=STAY&city=${encodeURIComponent(fixtureCity)}&startDate=${checkIn}&endDate=${checkOut}&rooms=2&pageSize=30`,
      );
      assert.equal(listingResponse.status, 200, JSON.stringify(listingResponse));
      const returnedTitles = listingResponse.data.map((offering) => offering.title);

      assert.deepEqual(
        returnedTitles,
        [eligibleTitle],
        'Public results must require approval, publication, and sufficient inventory on every requested night.',
      );
      assert.ok(!returnedTitles.includes('READINESS FIXTURE - No inventory'));
      assert.ok(!returnedTitles.includes('READINESS FIXTURE - Missing second night'));
      assert.ok(!returnedTitles.includes('READINESS FIXTURE - Only one room'));
      assert.ok(!returnedTitles.includes('READINESS FIXTURE - Unpublished'));
      assert.ok(!returnedTitles.includes('READINESS FIXTURE - Stale inventory'));

      const genericListing = await client.request<Array<{ title: string; kind: string }>>(
        `/offerings?city=${encodeURIComponent(fixtureCity)}&pageSize=30`,
      );
      assert.equal(genericListing.status, 200, JSON.stringify(genericListing));
      assert.deepEqual(
        genericListing.data
          .filter((offering) => offering.kind === 'STAY')
          .map((offering) => offering.title)
          .sort(),
        [
          eligibleTitle,
          'READINESS FIXTURE - Missing second night',
          'READINESS FIXTURE - Only one room',
        ].sort(),
        'Generic discovery may show fresh inventory without applying date/room filters, but must exclude stale, unpublished, and inventory-empty hotels.',
      );

      const staleQuote = await client.request('/quotes', 'POST', {
        offeringId: staleId,
        startDate: checkIn,
        endDate: checkOut,
        quantity: 1,
      });
      assert.equal(staleQuote.status, 409, JSON.stringify(staleQuote));
      assert.equal(staleQuote.error?.code, 'CAPACITY_CHANGED');

      const quote = await client.request<{ id: string }>('/quotes', 'POST', {
        offeringId: validId,
        startDate: checkIn,
        endDate: checkOut,
        quantity: 1,
      });
      assert.equal(quote.status, 200, JSON.stringify(quote));
      await pool.query(
        "UPDATE seven.inventory_windows SET inventory_confirmed_at=now()-interval '25 hours' WHERE offering_id=$1",
        [validId],
      );
      const staleHold = await client.request('/reservations', 'POST', {
        quoteId: quote.data.id,
      });
      assert.equal(staleHold.status, 409, JSON.stringify(staleHold));
      assert.equal(staleHold.error?.code, 'INVENTORY_STALE');
    } finally {
      if (server) {
        await new Promise<void>((resolve, reject) =>
          server!.close((error) => (error ? reject(error) : resolve())),
        );
      }

      if (schemaReady) {
        const businessIds = [pendingBusinessId].filter(
          (value): value is string => Boolean(value),
        );
        if (offeringIds.length) {
          await pool.query(
            'DELETE FROM seven.observations WHERE offering_id = ANY($1::uuid[])',
            [offeringIds],
          );
          await pool.query(
            'DELETE FROM seven.quotes WHERE offering_id = ANY($1::uuid[])',
            [offeringIds],
          );
          await pool.query(
            'DELETE FROM seven.inventory_windows WHERE offering_id = ANY($1::uuid[])',
            [offeringIds],
          );
          await pool.query(
            'DELETE FROM seven.offerings WHERE offering_id = ANY($1::uuid[])',
            [offeringIds],
          );
        }
        if (businessIds.length) {
          await pool.query(
            'DELETE FROM seven.outbox_events WHERE business_id = ANY($1::uuid[])',
            [businessIds],
          );
          await pool.query(
            'DELETE FROM seven.audit_events WHERE business_id = ANY($1::uuid[])',
            [businessIds],
          );
          await pool.query('DELETE FROM seven.sources WHERE business_id = ANY($1::uuid[])', [businessIds]);
          await pool.query('DELETE FROM seven.memberships WHERE business_id = ANY($1::uuid[])', [businessIds]);
          await pool.query('DELETE FROM seven.venues WHERE business_id = ANY($1::uuid[])', [businessIds]);
          await pool.query('DELETE FROM seven.businesses WHERE business_id = ANY($1::uuid[])', [businessIds]);
        }
        if (testUserIds.length) {
          await pool.query(
            'DELETE FROM seven.audit_events WHERE user_id = ANY($1::uuid[])',
            [testUserIds],
          );
          await pool.query(
            'DELETE FROM seven.idempotencies WHERE user_id = ANY($1::uuid[])',
            [testUserIds],
          );
          await pool.query(
            'DELETE FROM seven.sessions WHERE user_id = ANY($1::uuid[])',
            [testUserIds],
          );
          await pool.query('DELETE FROM seven.users WHERE user_id = ANY($1::uuid[])', [testUserIds]);
        }
      }
      if (ownsAppPool) await appPool.end();
      await pool.end();
    }
  },
);
