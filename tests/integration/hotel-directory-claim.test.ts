import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type * as C from '@7even/contracts';
import { createApp } from '../../backend/platform/src/app.ts';
import { MockCryptoGateway } from '../../backend/platform/src/cryptoProvider.ts';
import { createPool, one } from '../../backend/platform/src/db.ts';
import { migrate } from '../../backend/platform/src/migrate.ts';
import { MockProvider } from '../../backend/platform/src/provider.ts';
import { ProviderRegistry } from '../../backend/platform/src/providerRegistry.ts';
import { seed } from '../../backend/platform/src/seed.ts';

const origin = 'http://localhost:5177';
const password = 'Isolated-hotel-claim-regression-fixture-42!';

interface Result<T> {
  status: number;
  data: T;
  error?: { code: string; message: string };
}

class Client {
  readonly base: string;
  cookie = '';
  csrf = '';
  constructor(base: string) { this.base = base; }
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
}

interface DirectoryItem {
  id: string;
  name: string;
  claimable: boolean;
  claimed: boolean;
  bookable: boolean;
  amenities: { name: string }[];
  publishedRateNotes?: { roomType: string; rate: string; url: string }[];
}

test('Uyo hotel directory seeds 20 non-bookable profiles and authorised owners can claim one', {
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
  assert.deepEqual(target(ownerUrl), target(runtimeUrl), 'Owner and runtime must select the same isolated test database.');
  const pool = createPool(ownerUrl);
  const appPool = runtimeUrl === ownerUrl ? pool : createPool(runtimeUrl);
  const servers: Server[] = [];
  try {
    const identity = 'SELECT current_database() AS name, inet_server_addr()::text AS address, inet_server_port() AS port';
    const ownerIdentity = await one(pool, identity);
    assert.match(String(ownerIdentity?.name), /_test_db$/, 'A development or production database must never be reset.');
    assert.deepEqual(await one(appPool, identity), ownerIdentity);
    await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
    await migrate(pool);
    await seed(pool, password);

    const providers = new ProviderRegistry({
      mode: 'mock',
      adapters: { flutterwave: new MockProvider(), paystack: new MockProvider() },
      crypto: new MockCryptoGateway(),
    });
    const runtime = createApp({ pool: appPool, providers, environment: 'test', publicOrigin: origin });
    const server = await new Promise<Server>((resolve) => {
      const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    servers.push(server);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const guest = new Client(base);
    await guest.login('guest@seven.test');

    const directory = await guest.request<{ listings: DirectoryItem[]; total: number }>(
      '/directory?kind=STAY&state=Akwa%20Ibom&q=Uyo',
    );
    assert.equal(directory.status, 200, JSON.stringify(directory));
    const uyoHotels = directory.data.listings.filter((listing) => listing.name !== 'Kiniz Apartments and Hotel' && listing.name !== '1401 Luxury Apartments');
    assert.equal(uyoHotels.length, 20);
    assert.ok(!uyoHotels.some((listing) => /kiniz|1401/i.test(listing.name)));
    const madina = uyoHotels.find((listing) => listing.name === 'Madina Hotels & Residences');
    assert.ok(madina);
    assert.equal(madina.claimable, true);
    assert.equal(madina.claimed, false);
    assert.equal(madina.bookable, false);
    assert.equal(madina.publishedRateNotes?.length, 3);
    assert.ok(madina.amenities.some((amenity) => amenity.name === 'High-speed Wi-Fi'));

    const application = await guest.request('/business/applications', 'POST', {
      businessName: madina.name,
      city: 'Uyo',
      state: 'Akwa Ibom',
      address: '32 Abel Damina Road',
      phone: '+2348067428925',
      sector: 'STAY',
      description: 'Madina Hotels & Residences is a hotel and residences property in Uyo, Akwa Ibom State.',
      discoveryListingId: madina.id,
    });
    assert.equal(application.status, 200, JSON.stringify(application));

    const claimed = await one<{ claimed_business_id: string | null; claimed_at: string | null }>(
      pool,
      'SELECT claimed_business_id, claimed_at FROM seven.discovery_listings WHERE discovery_listing_id=$1',
      [madina.id],
    );
    assert.ok(claimed?.claimed_business_id);
    assert.ok(claimed?.claimed_at);
    const amenityRows = await one<{ total: number }>(
      pool,
      `SELECT count(*)::int AS total FROM seven.venue_amenities
       WHERE business_id=$1 AND status='INACTIVE'`,
      [claimed?.claimed_business_id],
    );
    assert.ok((amenityRows?.total ?? 0) > 0, 'Source amenities must be preloaded inactive until the owner confirms them.');

    const refreshed = await guest.request<{ listings: DirectoryItem[] }>(
      '/directory?kind=STAY&state=Akwa%20Ibom&q=Madina',
    );
    const claimedListing = refreshed.data.listings.find((listing) => listing.id === madina.id);
    assert.ok(claimedListing);
    assert.equal(claimedListing.claimable, false);
    assert.equal(claimedListing.claimed, true);
    assert.equal(claimedListing.bookable, false);

    const duplicate = await guest.request('/business/applications', 'POST', {
      businessName: madina.name,
      city: 'Uyo',
      state: 'Akwa Ibom',
      address: '32 Abel Damina Road',
      phone: '+2348067428925',
      sector: 'STAY',
      description: 'Duplicate claim must not create another business record.',
      discoveryListingId: madina.id,
    });
    assert.equal(duplicate.status, 409);
  } finally {
    await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })));
    if (appPool !== pool) await appPool.end();
    await pool.end();
  }
});
