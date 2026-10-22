import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type { Business, NigeriaLocation, Offering, SessionData, Venue } from '@7even/contracts';
import { createApp } from '../../services/platform/src/app.ts';
import { createPool, one } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';

test('state-scoped public search separates same-name cities and location edits retain only valid metadata', {
  skip: !process.env.TEST_DATABASE_URL || !process.env.TEST_RUNTIME_DATABASE_URL,
  timeout: 60000,
}, async () => {
  const ownerUrl = process.env.TEST_DATABASE_URL;
  const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL;
  assert.ok(ownerUrl && runtimeUrl);
  const targets = [ownerUrl, runtimeUrl].map((value) => {
    const url = new URL(value);
    assert.doesNotMatch(url.hostname, /(?:^|\.)supabase\.co$|(?:^|\.)pooler\.supabase\.com$/i);
    assert.match(decodeURIComponent(url.pathname.slice(1)), /_test_db$/);
    return [url.hostname, url.port || '5432', url.pathname];
  });
  assert.deepEqual(targets[0], targets[1]);
  const pool = createPool(ownerUrl);
  const appPool = createPool(runtimeUrl);
  let server: Server | undefined;
  let userId: string | undefined;
  let businessId: string | undefined;
  try {
    const identity = 'SELECT current_database() AS name,inet_server_addr()::text AS address,inet_server_port() AS port';
    const owner = await one(pool, identity);
    assert.match(String(owner?.name), /_test_db$/);
    assert.deepEqual(await one(appPool, identity), owner);
    await migrate(pool);
    const runtime = createApp({ pool: appPool, provider: new MockProvider(), environment: 'test' });
    server = await new Promise<Server>((resolve) => {
      const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    let cookie = '';
    let csrf = '';
    const request = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
      const response = await fetch(`${base}/api${path}`, {
        method,
        headers: { Origin: 'http://127.0.0.1:5177', 'Content-Type': 'application/json',
          Cookie: cookie, 'X-CSRF-Token': csrf, 'Idempotency-Key': randomUUID() },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const sessionCookie = response.headers.get('set-cookie');
      if (sessionCookie) cookie = sessionCookie.split(';')[0] ?? '';
      const payload = await response.json() as { data: T; error?: unknown };
      assert.equal(response.status, 200, JSON.stringify(payload));
      return payload.data;
    };
    const registration = await request<SessionData>('/auth/register', 'POST', {
      email: `location-${randomUUID()}@seven.test`, password: 'Location-Test-Only-Passphrase-42!', displayName: 'Location fixture owner',
    });
    assert.ok(registration.user && registration.csrfToken);
    userId = registration.user.id;
    csrf = registration.csrfToken;
    const city = `Location fixture ${randomUUID()}`;
    const business = await request<Business>('/business/applications', 'POST', {
      businessName: 'Location boundary fixture', city, state: 'lagos', address: '1 Isolated Test Lane',
      phone: '+2348012345678', sector: 'STAY', description: 'An isolated fixture for geographic search and metadata updates.',
    });
    businessId = business.id;
    assert.equal(business.state, 'Lagos');
    assert.equal((await one(pool, "SELECT details->>'state' AS state FROM seven.businesses WHERE business_id=$1", [businessId]))?.state, 'Lagos');
    await pool.query(
      "UPDATE seven.businesses SET workflow_state_id=(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED'),details=details || '{\"isSample\":true}'::jsonb WHERE business_id=$1",
      [businessId],
    );
    const venues = await request<Venue[]>('/business/venues');
    const firstVenue = venues[0];
    assert.ok(firstVenue);
    assert.equal('state' in firstVenue, false);
    const secondVenue = await request<Venue>('/business/venues', 'POST', {
      venueName: 'Second fixture venue', city, address: '2 Isolated Test Lane',
    });
    const startDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
    const offerInput = { title: 'Geographic fixture room', description: 'A room created only for isolated location integration tests.',
      kind: 'STAY', city, address: '1 Isolated Test Lane', priceMinor: '100000', capacity: 2,
      published: true, images: [], amenities: [], cancellationHours: 24, taxBps: 0, discountBps: 0 };
    const add = async (state: string | null | undefined, venueId: string, locationCity = city): Promise<Offering> => {
      const offering = await request<Offering>('/business/offerings', 'POST', {
        ...offerInput, venueId, city: locationCity, state,
      });
      await request(`/business/offerings/${offering.id}/availability`, 'POST', { startDate, endDate, capacity: 2 });
      return offering;
    };
    const lagos = await add('Lagos', firstVenue.id);
    assert.equal((await one(pool, "SELECT details->>'state' AS state FROM seven.offerings WHERE offering_id=$1", [lagos.id]))?.state, 'Lagos');
    const ogun = await add('Ogun', secondVenue.id);
    const unknown = await add(undefined, firstVenue.id);
    const extension = await add('Lagos', firstVenue.id, `${city} Extension`);
    const fixtureIds = [lagos.id, ogun.id, unknown.id, extension.id];
    const ids = (items: Offering[]) => items.filter((item) => fixtureIds.includes(item.id)).map((item) => item.id).sort();
    const stayQuery = `kind=STAY&startDate=${startDate}&endDate=${endDate}&rooms=1&pageSize=100`;
    for (const query of [stayQuery, 'pageSize=100']) {
      assert.deepEqual(ids(await request<Offering[]>(`/offerings?${query}&state=Lagos&city=${encodeURIComponent(city)}`)), [lagos.id]);
      assert.deepEqual(ids(await request<Offering[]>(`/offerings?${query}&state=Ogun&city=${encodeURIComponent(city)}`)), [ogun.id]);
      assert.deepEqual(ids(await request<Offering[]>(`/offerings?${query}&state=Lagos`)), [lagos.id, extension.id].sort());
      assert.deepEqual(ids(await request<Offering[]>(`/offerings?${query}&city=${encodeURIComponent(city)}`)), fixtureIds.slice().sort());
    }
    const unclassifiedAbuja = await add(undefined, firstVenue.id, 'Abuja');
    assert.equal(unclassifiedAbuja.state, null, 'A repeated city name must not imply a state.');
    const scopedAbuja = await request<Offering[]>(`/offerings?${stayQuery}&state=fct&city=Abuja`);
    assert.ok(!scopedAbuja.some((offering) => offering.id === unclassifiedAbuja.id));
    const retained = await request<Offering>(`/business/offerings/${lagos.id}`, 'PATCH', {
      ...offerInput, venueId: firstVenue.id, expectedRevision: lagos.revision,
    });
    assert.equal(retained.state, 'Lagos');
    const switched = await request<Offering>(`/business/offerings/${lagos.id}`, 'PATCH', {
      ...offerInput, venueId: secondVenue.id, expectedRevision: retained.revision,
    });
    assert.equal(switched.state, null);
    const restored = await request<Offering>(`/business/offerings/${lagos.id}`, 'PATCH', {
      ...offerInput, state: 'Lagos', venueId: firstVenue.id, expectedRevision: switched.revision,
    });
    assert.equal(restored.state, 'Lagos');
    const moved = await request<Offering>(`/business/offerings/${lagos.id}`, 'PATCH', {
      ...offerInput, city: `${city} Moved`, venueId: firstVenue.id, expectedRevision: restored.revision,
    });
    assert.equal(moved.state, null);
    const initial = await request<NigeriaLocation[]>('/locations');
    assert.equal(initial[0]?.name, 'Uyo');
    assert.equal(initial.length, 8);
    const locations = await request<NigeriaLocation[]>('/locations?q=Uyo&state=akwa-ibom&limit=3');
    assert.equal(locations[0]?.name, 'Uyo');
    assert.ok(locations.every((location) => location.state === 'Akwa Ibom'));
  } finally {
    const listener = server;
    if (listener) await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    if (businessId) {
      await pool.query('DELETE FROM seven.observations WHERE business_id=$1', [businessId]);
      await pool.query('DELETE FROM seven.inventory_windows WHERE offering_id IN (SELECT offering_id FROM seven.offerings WHERE business_id=$1)', [businessId]);
      await pool.query('DELETE FROM seven.offerings WHERE business_id=$1', [businessId]);
      await pool.query('DELETE FROM seven.outbox_events WHERE business_id=$1', [businessId]);
      await pool.query('DELETE FROM seven.audit_events WHERE business_id=$1', [businessId]);
      await pool.query('DELETE FROM seven.sources WHERE business_id=$1', [businessId]);
      await pool.query('DELETE FROM seven.memberships WHERE business_id=$1', [businessId]);
      await pool.query('DELETE FROM seven.venues WHERE business_id=$1', [businessId]);
      await pool.query('DELETE FROM seven.businesses WHERE business_id=$1', [businessId]);
    }
    if (userId) {
      for (const table of ['audit_events', 'idempotencies', 'sessions', 'notifications'])
        await pool.query(`DELETE FROM seven.${table} WHERE user_id=$1`, [userId]);
      await pool.query('DELETE FROM seven.users WHERE user_id=$1', [userId]);
    }
    await appPool.end();
    await pool.end();
  }
});
