import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type { Business, BusinessOverview, Offering, SessionData } from '@7even/contracts';
import { createApp } from '../../services/platform/src/app.ts';
import { createPool, one } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { offeringProjection } from '../../services/platform/src/store.ts';

test('business inventory excludes history before its limit and retains stale upcoming windows privately', {
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
  const userIds: string[] = [];
  const businessIds: string[] = [];
  let server: Server | undefined;
  try {
    const identity = 'SELECT current_database() AS name, inet_server_addr()::text AS address, inet_server_port() AS port';
    const database = await one(pool, identity);
    assert.match(String(database?.name), /_test_db$/);
    assert.deepEqual(await one(appPool, identity), database);
    await migrate(pool);
    const runtime = createApp({ pool: appPool, provider: new MockProvider(), environment: 'test' });
    server = await new Promise<Server>((resolve) => {
      const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    function client() {
      let cookie = '';
      let csrf = '';
      return async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
        const response = await fetch(base + path, {
          method,
          headers: { Origin: 'http://127.0.0.1:5177', 'Content-Type': 'application/json',
            Cookie: cookie, 'X-CSRF-Token': csrf, 'Idempotency-Key': randomUUID() },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const received = response.headers.get('set-cookie');
        if (received) cookie = received.split(';')[0] ?? '';
        const result = await response.json() as { data: T; error?: unknown };
        assert.equal(response.status, 200, JSON.stringify(result));
        if (path === '/auth/register') {
          const session = result.data as SessionData;
          assert.ok(session.user && session.csrfToken);
          userIds.push(session.user.id);
          csrf = session.csrfToken;
        }
        return result.data;
      };
    }
    const owner = client();
    const other = client();
    for (const request of [owner, other]) {
      await request<SessionData>('/auth/register', 'POST', {
        email: `inventory-history-${randomUUID()}@seven.test`, password: 'Inventory-History-Test-Passphrase-42!',
        displayName: 'Inventory history fixture',
      });
      const business = await request<Business>('/business/applications', 'POST', {
        businessName: 'Inventory history test property', city: 'Uyo', state: 'Akwa Ibom',
        address: '1 Isolated History Test Lane', phone: '+2348012345678', sector: 'STAY',
        description: 'Disposable property for private inventory history regression checks.',
      });
      businessIds.push(business.id);
    }
    const businessId = businessIds[0];
    assert.ok(businessId);
    await pool.query(`UPDATE seven.businesses SET workflow_state_id=(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED'),
      details=details||'{"verificationReview":{"checklistVersion":1,"inventoryFreshnessHours":24}}'::jsonb WHERE business_id=$1`, [businessId]);
    const offer = await owner<Offering>('/business/offerings', 'POST', {
      title: 'History regression fixture room', description: 'An isolated room type with long-lived inventory history.',
      kind: 'STAY', city: 'Uyo', state: 'Akwa Ibom', address: '1 Isolated History Test Lane',
      priceMinor: '4000000', capacity: 2, published: true,
    });
    await pool.query(`INSERT INTO seven.inventory_windows(inventory_window_id,offering_id,starts_at,ends_at,capacity,inventory_confirmed_at)
      SELECT gen_random_uuid(),$1,date_trunc('day',now())-(n+2)*interval '1 day',
        date_trunc('day',now())-(n+1)*interval '1 day',2,now() FROM generate_series(1,500) n`, [offer.id]);
    const currentId = randomUUID();
    const freshId = randomUUID();
    const staleId = randomUUID();
    await pool.query(`INSERT INTO seven.inventory_windows(inventory_window_id,offering_id,starts_at,ends_at,capacity,inventory_confirmed_at)
      VALUES ($2,$1,now()-interval '1 hour',now()+interval '1 hour',2,now()),
        ($3,$1,now()+interval '1 day',now()+interval '2 days',2,now()),
        ($4,$1,now()+interval '3 days',now()+interval '4 days',2,now()-interval '25 hours')`,
      [offer.id, currentId, freshId, staleId]);

    const view = await owner<BusinessOverview>('/business/overview');
    const privateOffer = view.offerings.find((item) => item.id === offer.id);
    assert.ok(privateOffer);
    assert.deepEqual(privateOffer.windows.map((window) => window.id), [currentId, freshId, staleId]);
    assert.ok(privateOffer.windows.every((window) => Date.parse(window.endAt) > Date.now()));
    assert.equal(view.listingReadiness.businesses[0]?.offerings[0]?.inventory.totalWindows, 503);
    const otherView = await other<BusinessOverview>('/business/overview');
    assert.deepEqual(otherView.offerings, []);
    assert.ok(!JSON.stringify(otherView).includes(staleId));

    const history = await offeringProjection(appPool, offer.id);
    assert.equal(history?.windows.length, 500, 'The existing default projection remains bounded and chronological.');
    assert.ok(history?.windows.every((window) => Date.parse(window.endAt) < Date.now()));
    const publicOffer = await offeringProjection(appPool, offer.id, true);
    assert.deepEqual(publicOffer?.windows.map((window) => window.id), [currentId, freshId], 'Public freshness filtering is unchanged; stale windows stay private.');
  } finally {
    const listener = server;
    if (listener) await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    if (businessIds.length) {
      await pool.query('DELETE FROM seven.inventory_windows WHERE offering_id IN (SELECT offering_id FROM seven.offerings WHERE business_id=ANY($1::uuid[]))', [businessIds]);
      await pool.query('DELETE FROM seven.offerings WHERE business_id=ANY($1::uuid[])', [businessIds]);
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
    await appPool.end();
    await pool.end();
  }
});
