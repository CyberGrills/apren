import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type * as C from '@7even/contracts';
import { createApp } from '../../services/platform/src/app.ts';
import { createPool, one } from '../../services/platform/src/db.ts';
import { listingReadiness } from '../../services/platform/src/listingReadiness.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';

const origin = 'http://127.0.0.1:5177';
const password = 'Listing-Readiness-Test-Passphrase-42!';

test('listing diagnostics explain inventory, preserve tenant access, and count beyond detail limits', {
  skip: !process.env.TEST_DATABASE_URL || !process.env.TEST_RUNTIME_DATABASE_URL,
  timeout: 120000,
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
  const users: string[] = [];
  const businesses: string[] = [];
  const reservationIds: string[] = [];
  const quoteIds: string[] = [];
  let server: Server | undefined;
  try {
    const identity = await one(pool, 'SELECT current_database() AS name, inet_server_port() AS port');
    assert.match(String(identity?.name), /_test_db$/);
    assert.deepEqual(await one(appPool, 'SELECT current_database() AS name, inet_server_port() AS port'), identity);
    await migrate(pool);
    const runtime = createApp({ pool: appPool, provider: new MockProvider(), environment: 'test', publicOrigin: origin });
    server = await new Promise<Server>((resolve) => {
      const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    class Client {
      cookie = '';
      csrf = '';
      email = `listing-readiness-${randomUUID()}@seven.test`;
      async request<T>(path: string, method = 'GET', body?: unknown, expected = 200): Promise<T> {
        const response = await fetch(`${base}/api${path}`, {
          method,
          headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: this.cookie,
            'X-CSRF-Token': this.csrf, 'Idempotency-Key': randomUUID() },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const sessionCookie = response.headers.get('set-cookie');
        if (sessionCookie) this.cookie = sessionCookie.split(';')[0] ?? '';
        const result = await response.json() as { data: T; error?: unknown };
        assert.equal(response.status, expected, JSON.stringify(result));
        return result.data;
      }
      async register() {
        const session = await this.request<C.SessionData>('/auth/register', 'POST', {
          email: this.email, password, displayName: 'Listing readiness fixture',
        });
        assert.ok(session.user && session.csrfToken);
        users.push(session.user.id);
        this.csrf = session.csrfToken;
        return session.user.id;
      }
      async login() {
        const session = await this.request<C.SessionData>('/auth/login', 'POST', { email: this.email, password });
        assert.ok(session.csrfToken);
        this.csrf = session.csrfToken;
      }
      async apply(name: string) {
        const business = await this.request<C.Business>('/business/applications', 'POST', {
          businessName: name, city: 'Uyo', state: 'Akwa Ibom', address: '1 Isolated Test Lane, Uyo',
          phone: '+2348012345678', sector: 'STAY',
          description: 'Disposable integration fixture, never a real or public hotel.',
        });
        businesses.push(business.id);
        await this.login();
        return business;
      }
    }
    const anonymous = new Client();
    await anonymous.request('/admin/overview', 'GET', undefined, 401);
    await anonymous.request('/admin/listing-readiness?businessId=invalid', 'GET', undefined, 401);
    const owner = new Client();
    await owner.register();
    await owner.request('/business/overview', 'GET', undefined, 403);
    const business = await owner.apply('Readiness fixture hotel');
    const readiness = async () => (await owner.request<C.BusinessOverview>('/business/overview')).listingReadiness;
    let view = await readiness();
    assert.equal(view.database.status, 'connected');
    assert.ok(Number.isFinite(Date.parse(view.database.checkedAt)));
    assert.deepEqual(view.totals, { businesses: 1, offerings: 0, published: 0, eligible: 0, blocked: 0 });
    assert.deepEqual(view.businesses[0]?.blockers, ['BUSINESS_NOT_APPROVED', 'HOTEL_VERIFICATION_REQUIRED', 'NO_OFFERINGS']);
    await owner.request('/admin/overview', 'GET', undefined, 403);
    await owner.request('/admin/listing-readiness?businessId=invalid', 'GET', undefined, 403);

    const admin = new Client();
    const adminId = await admin.register();
    await pool.query("UPDATE seven.users SET role_id=(SELECT role_id FROM seven.roles WHERE role_code='ADMIN') WHERE user_id=$1", [adminId]);
    await admin.login();
    await admin.request('/admin/listing-readiness?businessId=invalid', 'GET', undefined, 422);
    const unknownBusiness = await admin.request<C.ListingReadiness>(`/admin/listing-readiness?businessId=${randomUUID()}`);
    assert.deepEqual(unknownBusiness.totals, { businesses: 0, offerings: 0, published: 0, eligible: 0, blocked: 0 });
    assert.deepEqual(unknownBusiness.businesses, []);
    const evidence = { confirmed: true, evidenceReference: 'isolated-test:confirmed-evidence' };
    await admin.request(`/admin/businesses/${business.id}/status`, 'POST', {
      status: 'APPROVED', reason: 'Isolated diagnostic test approval',
      verification: { propertyExists: evidence, partnerAuthority: evidence, directContact: evidence,
        fullAddress: evidence, coordinates: evidence, currentRates: evidence,
        roomInventoryAndPolicies: evidence, inventoryFreshnessHours: 24 },
    });
    const offerInput = {
      title: 'Readiness fixture room', description: 'Disposable room for inventory diagnostic checks.',
      kind: 'STAY' as const, city: 'Uyo', state: 'Akwa Ibom', address: '1 Isolated Test Lane, Uyo',
      priceMinor: '4500000', capacity: 2, published: false,
    };
    const offer = await owner.request<C.Offering>('/business/offerings', 'POST', offerInput);
    view = await readiness();
    assert.deepEqual(view.businesses[0]?.offerings[0]?.blockers, ['OFFERING_UNPUBLISHED', 'NO_INVENTORY']);
    const date = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
    await owner.request(`/business/offerings/${offer.id}/availability`, 'POST', { startDate: date, capacity: 2 });
    await owner.request<C.Offering>(`/business/offerings/${offer.id}`, 'PATCH', {
      ...offerInput, published: true, expectedRevision: offer.revision,
    });
    view = await readiness();
    assert.equal(view.totals.eligible, 1);
    assert.deepEqual(view.businesses[0]?.offerings[0]?.blockers, []);
    assert.equal(view.businesses[0]?.offerings[0]?.inventory.availableWindows, 1);
    const publicResults = await anonymous.request<C.Offering[]>('/offerings?kind=STAY&city=Uyo&pageSize=100');
    assert.ok(publicResults.some((item) => item.id === offer.id));

    const customer = new Client();
    await customer.register();
    const endDate = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const quote = await customer.request<C.Quote>('/quotes', 'POST', { offeringId: offer.id, startDate: date, endDate, quantity: 1 });
    quoteIds.push(quote.id);
    const reservation = await customer.request<C.Reservation>('/reservations', 'POST', { quoteId: quote.id });
    reservationIds.push(reservation.id);
    const beforeExceptions = (await admin.request<C.AdminOverview>('/admin/overview')).exceptionsSummary.total;
    const oldPaymentId = randomUUID();
    const paymentIds = [oldPaymentId, ...Array.from({ length: 200 }, () => randomUUID())];
    // Synthetic database records only: no checkout, provider call, or financial posting is performed.
    await pool.query(`INSERT INTO seven.payment_attempts(payment_attempt_id,reservation_id,merchant_reference,
      workflow_state_id,settlement_state_id,currency_code,amount_minor,commission_minor,business_subaccount,
      bank_revision,payment_provider_id,payment_method_id,routing_policy_version,provider_details,created_at)
      SELECT id,$1,'DIAGNOSTIC-'||id::text,
        (SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code=CASE WHEN position=1 THEN 'UNKNOWN' ELSE 'FAILED' END),
        (SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='UNSETTLED'),
        'NGN',4500000,450000,'isolated-test-account',0,
        (SELECT payment_provider_id FROM seven.payment_providers WHERE provider_code='flutterwave'),
        (SELECT payment_method_id FROM seven.payment_methods WHERE method_code='FIAT'),
        'isolated-diagnostic-fixture','{"mode":"mock"}'::jsonb,
        CASE WHEN position=1 THEN now()-interval '2 days' ELSE now() END
      FROM unnest($2::uuid[]) WITH ORDINALITY AS fixture(id,position)`, [reservation.id, paymentIds]);
    const exceptionsView = await admin.request<C.AdminOverview>('/admin/overview');
    assert.ok(!exceptionsView.payments.some((payment) => payment.id === oldPaymentId), 'Fixture is older than the latest 200 payment records.');
    assert.ok(exceptionsView.exceptions.some((exception) => exception.id === oldPaymentId && exception.kind === 'PAYMENT'), 'An unresolved payment must remain visible after 200 newer transactions.');
    assert.equal(exceptionsView.exceptionsSummary.total, beforeExceptions + 1);
    assert.equal(exceptionsView.exceptionsSummary.shown, exceptionsView.exceptions.length);
    assert.equal(exceptionsView.exceptionsSummary.perCategoryLimit, 100);

    await pool.query("UPDATE seven.offerings SET details=details-'state' WHERE offering_id=$1", [offer.id]);
    view = await readiness();
    assert.equal(view.totals.eligible, 1, 'Missing state only affects scoped discovery, not unfiltered visibility.');
    assert.deepEqual(view.businesses[0]?.offerings[0]?.warnings, ['STATE_MISSING']);
    await pool.query("UPDATE seven.offerings SET details=details||'{\"state\":\"Unknown test state\"}'::jsonb WHERE offering_id=$1", [offer.id]);
    assert.deepEqual((await readiness()).businesses[0]?.offerings[0]?.warnings, ['STATE_UNRECOGNIZED']);
    await pool.query('UPDATE seven.inventory_windows SET allocated_count=capacity WHERE offering_id=$1', [offer.id]);
    assert.deepEqual((await readiness()).businesses[0]?.offerings[0]?.blockers, ['INVENTORY_SOLD_OUT']);
    await pool.query("UPDATE seven.inventory_windows SET allocated_count=0,inventory_confirmed_at=now()-interval '25 hours' WHERE offering_id=$1", [offer.id]);
    assert.deepEqual((await readiness()).businesses[0]?.offerings[0]?.blockers, ['INVENTORY_STALE']);
    await pool.query("UPDATE seven.inventory_windows SET starts_at=now()-interval '3 days',ends_at=now()-interval '2 days',inventory_confirmed_at=now() WHERE offering_id=$1", [offer.id]);
    assert.deepEqual((await readiness()).businesses[0]?.offerings[0]?.blockers, ['INVENTORY_EXPIRED']);
    await pool.query("UPDATE seven.businesses SET details=details-'verificationReview' WHERE business_id=$1", [business.id]);
    assert.ok((await readiness()).businesses[0]?.offerings[0]?.blockers.includes('HOTEL_VERIFICATION_REQUIRED'));

    const other = new Client();
    await other.register();
    const otherBusiness = await other.apply('Other readiness fixture hotel');
    const otherView = (await other.request<C.BusinessOverview>('/business/overview')).listingReadiness;
    assert.equal(otherView.totals.businesses, 1);
    assert.equal(otherView.totals.offerings, 0);
    assert.deepEqual(otherView.businesses.map((item) => item.businessId), [otherBusiness.id]);
    assert.ok(!JSON.stringify(otherView).includes(offer.id));
    const globalView = (await admin.request<C.AdminOverview>('/admin/overview')).listingReadiness;
    assert.ok(globalView.businesses.some((item) => item.businessId === business.id));
    assert.ok(globalView.businesses.some((item) => item.businessId === otherBusiness.id));

    await admin.request(`/admin/businesses/${business.id}/status`, 'POST', {
      status: 'APPROVED', reason: 'Restore isolated hotel verification for conversion diagnostics',
      verification: { propertyExists: evidence, partnerAuthority: evidence, directContact: evidence,
        fullAddress: evidence, coordinates: evidence, currentRates: evidence,
        roomInventoryAndPolicies: evidence, inventoryFreshnessHours: 24 },
    });
    const conversionInput = { ...offerInput, title: 'Conversion conflict fixture', kind: 'DINING', published: true };
    const dining = await owner.request<C.Offering>('/business/offerings', 'POST', conversionInput);
    for (const hour of ['18', '21']) {
      await owner.request(`/business/offerings/${dining.id}/availability`, 'POST', {
        startDate: date, startAt: `${date}T${hour}:00:00+01:00`,
        endAt: `${date}T${Number(hour) + 1}:00:00+01:00`, capacity: 2,
      });
    }
    await owner.request<C.Offering>(`/business/offerings/${dining.id}`, 'PATCH', {
      ...conversionInput, kind: 'STAY', expectedRevision: dining.revision,
    });
    const conflicted = (await readiness()).businesses[0]?.offerings.find((item) => item.offeringId === dining.id);
    assert.ok(conflicted);
    assert.equal(conflicted.eligible, false);
    assert.deepEqual(conflicted.blockers, ['INVENTORY_CONFLICT']);
    assert.deepEqual(conflicted.inventory, { totalWindows: 2, currentWindows: 2, freshWindows: 2, availableWindows: 2 });
    assert.ok(!(await anonymous.request<C.Offering[]>('/offerings?kind=STAY&city=Uyo&pageSize=100')).some((item) => item.id === dining.id), 'Duplicate fresh windows on the same service date must not make a hotel searchable.');
    const nextUniqueDate = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    await owner.request(`/business/offerings/${dining.id}/availability`, 'POST', { startDate: nextUniqueDate, capacity: 2 });
    const resolved = (await readiness()).businesses[0]?.offerings.find((item) => item.offeringId === dining.id);
    assert.equal(resolved?.eligible, true, 'A later unambiguous service date can make the hotel searchable.');
    assert.deepEqual(resolved?.blockers, []);
    assert.equal(resolved?.inventory.availableWindows, 3, 'Window counts remain complete; they are not counts of unique service days.');
    assert.ok((await anonymous.request<C.Offering[]>('/offerings?kind=STAY&city=Uyo&pageSize=100')).some((item) => item.id === dining.id));

    const cappedOffer = await owner.request<C.Offering>('/business/offerings', 'POST', {
      ...offerInput, title: 'Projection limit fixture', published: true,
    });
    await pool.query(`INSERT INTO seven.inventory_windows(inventory_window_id,offering_id,starts_at,ends_at,capacity,allocated_count,inventory_confirmed_at)
      SELECT gen_random_uuid(),$1,date_trunc('day',now())+(n+5)*interval '1 day'+interval '12 hours',
        date_trunc('day',now())+(n+6)*interval '1 day'+interval '12 hours',2,CASE WHEN n<=500 THEN 2 ELSE 0 END,now()
      FROM generate_series(1,501) n`, [cappedOffer.id]);
    const cappedReadiness = (await readiness()).businesses[0]?.offerings.find((item) => item.offeringId === cappedOffer.id);
    assert.equal(cappedReadiness?.eligible, false);
    assert.deepEqual(cappedReadiness?.blockers, ['INVENTORY_PROJECTION_LIMIT']);
    assert.deepEqual(cappedReadiness?.inventory, { totalWindows: 501, currentWindows: 501, freshWindows: 501, availableWindows: 1 });
    assert.ok(!(await anonymous.request<C.Offering[]>('/offerings?kind=STAY&city=Uyo&pageSize=100')).some((item) => item.id === cappedOffer.id), 'Capacity outside the engine projection slice must not make diagnostics claim visibility.');

    const extraBusinessIds = Array.from({ length: 101 }, () => randomUUID());
    businesses.push(...extraBusinessIds);
    await pool.query(`INSERT INTO seven.businesses(business_id,business_name,slug,city,description,workflow_state_id,details)
      SELECT id,'Bounded diagnostic fixture',id::text,'Uyo','Isolated diagnostic count fixture',
        (SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED'),'{"sector":"DINING"}'::jsonb
      FROM unnest($1::uuid[]) id`, [extraBusinessIds]);
    await pool.query(`INSERT INTO seven.offerings(offering_id,business_id,sector_id,title,description,city,price_minor,is_published)
      SELECT gen_random_uuid(),$1,(SELECT sector_id FROM seven.sectors WHERE sector_code='DINING'),
        'Bounded offering '||n,'Isolated diagnostic count fixture','Uyo',10000,true FROM generate_series(1,101) n`, [otherBusiness.id]);
    const bounded = await listingReadiness(appPool, { businessId: otherBusiness.id, production: true });
    assert.equal(bounded.totals.offerings, 101);
    assert.equal(bounded.totals.eligible, 0, 'Pending business cannot expose published dining listings.');
    assert.equal(bounded.businesses[0]?.offerings.length, 100);
    assert.equal(bounded.businesses[0]?.offeringsTruncated, true);
    const all = await listingReadiness(appPool, { production: true });
    assert.ok(all.totals.businesses >= 103);
    assert.equal(all.businesses.length, 100);
    assert.equal(all.businessesTruncated, true);
    assert.ok(all.totals.offerings >= 102);
    assert.equal(all.totals.eligible + all.totals.blocked, all.totals.offerings);
    assert.ok(!all.businesses.some((item) => item.businessId === business.id), 'Older business is outside the bounded global detail records.');
    const scoped = await admin.request<C.ListingReadiness>(`/admin/listing-readiness?businessId=${business.id}`);
    assert.deepEqual(scoped.totals, { businesses: 1, offerings: 3, published: 3, eligible: 1, blocked: 2 });
    assert.deepEqual(scoped.businesses.map((item) => item.businessId), [business.id]);
    assert.equal(scoped.businessesTruncated, false);
    assert.ok(scoped.businesses[0]?.offerings.some((item) => item.offeringId === offer.id));
  } finally {
    const listener = server;
    if (listener) await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    if (businesses.length) {
      if (reservationIds.length) {
        await pool.query('DELETE FROM seven.payment_attempts WHERE reservation_id=ANY($1::uuid[])', [reservationIds]);
        await pool.query('DELETE FROM seven.allocations WHERE reservation_id=ANY($1::uuid[])', [reservationIds]);
        await pool.query('DELETE FROM seven.reservations WHERE reservation_id=ANY($1::uuid[])', [reservationIds]);
      }
      if (quoteIds.length) await pool.query('DELETE FROM seven.quotes WHERE quote_id=ANY($1::uuid[])', [quoteIds]);
      await pool.query('DELETE FROM seven.observations WHERE business_id=ANY($1::uuid[])', [businesses]);
      await pool.query('DELETE FROM seven.inventory_windows WHERE offering_id IN (SELECT offering_id FROM seven.offerings WHERE business_id=ANY($1::uuid[]))', [businesses]);
      await pool.query('DELETE FROM seven.offerings WHERE business_id=ANY($1::uuid[])', [businesses]);
      for (const table of ['outbox_events', 'audit_events', 'sources', 'memberships', 'venues', 'businesses']) {
        await pool.query(`DELETE FROM seven.${table} WHERE business_id=ANY($1::uuid[])`, [businesses]);
      }
    }
    if (users.length) {
      for (const table of ['audit_events', 'idempotencies', 'sessions', 'notifications']) {
        await pool.query(`DELETE FROM seven.${table} WHERE user_id=ANY($1::uuid[])`, [users]);
      }
      await pool.query('DELETE FROM seven.users WHERE user_id=ANY($1::uuid[])', [users]);
    }
    await appPool.end();
    await pool.end();
  }
});
