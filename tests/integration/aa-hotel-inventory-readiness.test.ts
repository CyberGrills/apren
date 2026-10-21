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

const origin = 'http://localhost:5177';
const password = 'HotelReadiness-Test-Passphrase-42!';

function assertDisposableDatabaseUrl(value: string, label: string): URL {
  const parsed = new URL(value);
  assert.doesNotMatch(
    parsed.hostname,
    /(?:^|\\.)supabase\\.co$|(?:^|\\.)pooler\\.supabase\\.com$/i,
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
  'hotel onboarding approval and room-night inventory eligibility are safe and fail closed',
  { skip: !process.env.TEST_DATABASE_URL, timeout: 120000 },
  async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL!;
    const parsedTestUrl = assertDisposableDatabaseUrl(testDatabaseUrl, 'TEST_DATABASE_URL');
    const pool = createPool(testDatabaseUrl);
    let appPool = pool;
    let ownsAppPool = false;
    let schemaReady = false;
    let server: Server | undefined;
    let testUserId: string | undefined;
    let pendingBusinessId: string | undefined;
    let approvedBusinessId: string | undefined;
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
      const address = server.address() as AddressInfo;
      const client = new Client(`http://127.0.0.1:${address.port}`);
      const email = `inventory-readiness-${randomUUID()}@seven.test`;
      const user = await client.register(email);
      testUserId = user.id;

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
        priceMinor: 12000000,
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

      const fixtureBusiness = randomUUID();
      const fixtureVenue = randomUUID();
      approvedBusinessId = fixtureBusiness;
      const fixtureCity = 'Readiness Test City';
      const businessName = 'Isolated Inventory Eligibility Fixture';

      await pool.query(
        `INSERT INTO seven.businesses
           (business_id,business_name,slug,city,description,workflow_state_id,details)
         VALUES
           ($1,$2,$3,$4,$5,
            (SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED'),
            $6::jsonb)`,
        [
          fixtureBusiness,
          businessName,
          `readiness-fixture-${fixtureBusiness.slice(0, 8)}`,
          fixtureCity,
          'Isolated automated test fixture; not an actual hotel.',
          JSON.stringify({
            address: '2 Isolated Test Lane, Readiness Test City',
            sector: 'STAY',
            isSample: true,
            isTestFixture: true,
          }),
        ],
      );
      await pool.query(
        `INSERT INTO seven.venues
           (venue_id,business_id,venue_name,address_line,city,timezone_name)
         VALUES ($1,$2,$3,$4,$5,'Africa/Lagos')`,
        [
          fixtureVenue,
          fixtureBusiness,
          businessName,
          '2 Isolated Test Lane, Readiness Test City',
          fixtureCity,
        ],
      );

      const checkIn = lagosDateOffset(7);
      const checkOut = calendarDateOffset(checkIn, 2);
      const eligibleTitle = 'READINESS FIXTURE - Full two-night capacity';

      async function addOffer(
        businessId: string,
        title: string,
        capacity: number,
      ): Promise<string> {
        const offeringId = randomUUID();
        offeringIds.push(offeringId);
        await pool.query(
          `INSERT INTO seven.offerings
             (offering_id,business_id,venue_id,sector_id,title,description,city,price_minor,is_published,details)
           VALUES
             ($1,$2,$3,
              (SELECT sector_id FROM seven.sectors WHERE sector_code='STAY'),
              $4,$5,$6,12000000,true,$7::jsonb)`,
          [
            offeringId,
            businessId,
            businessId === fixtureBusiness ? fixtureVenue : null,
            title,
            'Synthetic test-only listing used to verify public eligibility.',
            fixtureCity,
            JSON.stringify({
              address: '2 Isolated Test Lane, Readiness Test City',
              capacity,
              amenities: [],
              images: [],
              cancellationHours: 24,
              discountBps: 0,
              isSample: true,
            }),
          ],
        );
        return offeringId;
      }

      async function addNightWindows(
        offeringId: string,
        offsets: number[],
        capacity: number,
      ): Promise<void> {
        for (const offset of offsets) {
          await pool.query(
            `INSERT INTO seven.inventory_windows
               (inventory_window_id,offering_id,starts_at,ends_at,capacity)
             VALUES
               ($1,$2,
                ($3::date + $4::int + time '13:00') AT TIME ZONE 'UTC',
                ($3::date + $4::int + 1 + time '10:00') AT TIME ZONE 'UTC',
                $5)`,
            [randomUUID(), offeringId, checkIn, offset, capacity],
          );
        }
      }

      const validId = await addOffer(fixtureBusiness, eligibleTitle, 2);
      await addOffer(
        fixtureBusiness,
        'READINESS FIXTURE - No inventory',
        2,
      );
      const partialId = await addOffer(
        fixtureBusiness,
        'READINESS FIXTURE - Missing second night',
        2,
      );
      const lowCapacityId = await addOffer(
        fixtureBusiness,
        'READINESS FIXTURE - Only one room',
        1,
      );
      const pendingId = await addOffer(
        pendingBusinessId,
        'READINESS FIXTURE - Pending business with inventory',
        2,
      );

      await addNightWindows(validId, [0, 1], 2);
      await addNightWindows(partialId, [0], 2);
      await addNightWindows(lowCapacityId, [0, 1], 1);
      await addNightWindows(pendingId, [0, 1], 2);

      const listingResponse = await client.request<Array<{ title: string }>>(
        `/offerings?kind=STAY&city=${encodeURIComponent(fixtureCity)}&startDate=${checkIn}&endDate=${checkOut}&rooms=2&pageSize=30`,
      );
      assert.equal(listingResponse.status, 200, JSON.stringify(listingResponse));
      const returnedTitles = listingResponse.data.map((offering) => offering.title);

      assert.deepEqual(
        returnedTitles,
        [eligibleTitle],
        'Public results must require an approved business and sufficient inventory on every requested night.',
      );
      assert.ok(!returnedTitles.includes('READINESS FIXTURE - No inventory'));
      assert.ok(!returnedTitles.includes('READINESS FIXTURE - Missing second night'));
      assert.ok(!returnedTitles.includes('READINESS FIXTURE - Only one room'));
      assert.ok(!returnedTitles.includes('READINESS FIXTURE - Pending business with inventory'));
    } finally {
      if (server) {
        await new Promise<void>((resolve, reject) =>
          server!.close((error) => (error ? reject(error) : resolve())),
        );
      }

      if (schemaReady) {
        const businessIds = [pendingBusinessId, approvedBusinessId].filter(
          (value): value is string => Boolean(value),
        );
        if (offeringIds.length) {
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
            'DELETE FROM seven.audit_events WHERE business_id = ANY($1::uuid[])',
            [businessIds],
          );
          await pool.query('DELETE FROM seven.sources WHERE business_id = ANY($1::uuid[])', [businessIds]);
          await pool.query('DELETE FROM seven.memberships WHERE business_id = ANY($1::uuid[])', [businessIds]);
          await pool.query('DELETE FROM seven.venues WHERE business_id = ANY($1::uuid[])', [businessIds]);
          await pool.query('DELETE FROM seven.businesses WHERE business_id = ANY($1::uuid[])', [businessIds]);
        }
        if (testUserId) {
          await pool.query('DELETE FROM seven.audit_events WHERE user_id=$1', [testUserId]);
          await pool.query('DELETE FROM seven.idempotencies WHERE user_id=$1', [testUserId]);
          await pool.query('DELETE FROM seven.sessions WHERE user_id=$1', [testUserId]);
          await pool.query('DELETE FROM seven.users WHERE user_id=$1', [testUserId]);
        }
      }
      if (ownsAppPool) await appPool.end();
      await pool.end();
    }
  },
);
