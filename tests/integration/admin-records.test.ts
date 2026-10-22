import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type {
  Activity,
  AdminRecordsPage,
  Business,
  BusinessOverview,
  Payment,
  Reservation,
  SessionData,
} from '@7even/contracts';
import { createApp } from '../../services/platform/src/app.ts';
import { createPool, one } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { sid } from '../../services/platform/src/store.ts';

interface Result<T> {
  status: number;
  data: T;
  error?: { code: string };
}

test('admin record searches page all matching database records behind the existing staff role', {
  skip: !process.env.TEST_DATABASE_URL || !process.env.TEST_RUNTIME_DATABASE_URL,
  timeout: 90000,
}, async (t) => {
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
  const owner = createPool(ownerUrl);
  const runtimePool = createPool(runtimeUrl);
  const prefix = `adminrecords-${randomUUID()}`;
  const userIds: string[] = [];
  const businessIds: string[] = [];
  let server: Server | undefined;
  try {
    const identity =
      'SELECT current_database() AS name,inet_server_addr()::text AS address,inet_server_port() AS port';
    const database = await one(owner, identity);
    assert.match(String(database?.name), /_test_db$/);
    assert.deepEqual(await one(runtimePool, identity), database);
    await migrate(owner);
    const runtime = createApp({
      pool: runtimePool,
      provider: new MockProvider(),
      environment: 'test',
    });
    server = await new Promise<Server>((resolve) => {
      const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    function client() {
      let cookie = '';
      return async <T>(path: string, method = 'GET', body?: unknown): Promise<Result<T>> => {
        const response = await fetch(base + path, {
          method,
          headers: {
            Origin: 'http://127.0.0.1:5177',
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const received = response.headers.get('set-cookie');
        if (received) cookie = received.split(';')[0] ?? '';
        const result = (await response.json()) as { data: T; error?: { code: string } };
        return { status: response.status, ...result };
      };
    }
    const anonymous = client();
    const customer = client();
    const admin = client();
    const businessOwner = client();
    const otherOwner = client();
    const receptionist = client();
    for (const [request, role, label] of [
      [customer, 'CUSTOMER', 'customer'],
      [admin, 'ADMIN', 'admin'],
      [businessOwner, 'BUSINESS_OWNER', 'owner'],
      [otherOwner, 'BUSINESS_OWNER', 'other-owner'],
      [receptionist, 'RECEPTION', 'reception'],
    ] as const) {
      const registration = await request<SessionData>('/auth/register', 'POST', {
        email: `${label}-${prefix}@seven.test`,
        password: `Isolated-${randomUUID()}-Only`,
        displayName: 'Admin record test account',
      });
      assert.equal(registration.status, 200, JSON.stringify(registration));
      assert.ok(registration.data.user);
      userIds.push(registration.data.user.id);
      await owner.query(
        'UPDATE seven.users SET role_id=(SELECT role_id FROM seven.roles WHERE role_code=$2) WHERE user_id=$1',
        [registration.data.user.id, role],
      );
    }
    const customerId = userIds[0];
    const adminId = userIds[1];
    assert.ok(customerId && adminId);
    const inserted = await owner.query<{ business_id: string }>(
      `INSERT INTO seven.businesses(business_id,business_name,slug,city,description,workflow_state_id,details,created_at)
       SELECT gen_random_uuid(),$1||' '||lpad(n::text,3,'0'),gen_random_uuid()::text,'Uyo','Isolated dashboard test fixture',${sid('PENDING')},
              '{"sector":"DINING","isSample":true}'::jsonb,'2020-01-01T00:00:00Z'::timestamptz+n*interval '1 second'
       FROM generate_series(0,204) AS n RETURNING business_id`,
      [prefix],
    );
    businessIds.push(...inserted.rows.map((item) => item.business_id));
    const businessId = businessIds[0];
    const otherBusinessId = businessIds[1];
    assert.ok(businessId && otherBusinessId);
    for (const [userId, tenantId, role] of [
      [userIds[2], businessId, 'BUSINESS_OWNER'],
      [userIds[3], otherBusinessId, 'BUSINESS_OWNER'],
      [userIds[4], businessId, 'RECEPTION'],
    ]) {
      assert.ok(userId);
      await owner.query(
        `INSERT INTO seven.memberships(membership_id,user_id,business_id,role_id)
        VALUES($1,$2,$3,(SELECT role_id FROM seven.roles WHERE role_code=$4))`,
        [randomUUID(), userId, tenantId, role],
      );
    }
    const venueId = randomUUID();
    const offeringId = randomUUID();
    await owner.query(
      'INSERT INTO seven.venues(venue_id,business_id,venue_name,address_line,city) VALUES($1,$2,$3,$4,$5)',
      [venueId, businessId, 'Isolated fixture venue', '1 Test Lane', 'Uyo'],
    );
    await owner.query(
      `INSERT INTO seven.offerings(offering_id,business_id,venue_id,sector_id,title,description,city,price_minor,is_published)
      VALUES($1,$2,$3,(SELECT sector_id FROM seven.sectors WHERE sector_code='DINING'),$4,'Isolated record search fixture','Uyo',10000,false)`,
      [offeringId, businessId, venueId, prefix],
    );
    const prices = {
      subtotalMinor: '10000',
      discountMinor: '0',
      serviceMinor: '10000',
      taxMinor: '0',
      totalMinor: '10000',
      commissionMinor: '1000',
      businessGrossMinor: '9000',
    };
    for (let index = 0; index < 3; index++) {
      const quoteId = randomUUID();
      const reservationId = randomUUID();
      const paymentId = randomUUID();
      const reference = `${prefix}-${index}`;
      const createdAt = `2020-01-01T00:00:0${index}Z`;
      await owner.query(
        `INSERT INTO seven.quotes(quote_id,user_id,offering_id,starts_at,ends_at,quantity,amounts,inventory_ids,expires_at,terms_snapshot)
        VALUES($1,$2,$3,now()+interval '1 day',now()+interval '1 day 2 hours',1,$4,'[]',now()+interval '1 day',$5)`,
        [
          quoteId,
          customerId,
          offeringId,
          prices,
          { title: reference, kind: 'DINING', city: 'Uyo', startDate: '2026-11-01', quantity: 1 },
        ],
      );
      await owner.query(
        `INSERT INTO seven.reservations(reservation_id,user_id,business_id,offering_id,quote_id,workflow_state_id,payment_state_id,expires_at,created_at)
        VALUES($1,$2,$3,$4,$5,${sid('HELD')},${sid('UNPAID')},now()+interval '1 day',$6)`,
        [reservationId, customerId, businessId, offeringId, quoteId, createdAt],
      );
      await owner.query(
        `INSERT INTO seven.payment_attempts(payment_attempt_id,reservation_id,merchant_reference,workflow_state_id,settlement_state_id,currency_code,amount_minor,commission_minor,business_subaccount,bank_revision,payment_provider_id,payment_method_id,routing_policy_version,created_at)
        VALUES($1,$2,$3,${sid('PENDING')},${sid('UNSETTLED')},'NGN',10000,1000,'isolated-test-no-bank',1,
               (SELECT payment_provider_id FROM seven.payment_providers WHERE provider_code='paystack'),
               (SELECT payment_method_id FROM seven.payment_methods WHERE method_code='FIAT'),'7even-fiat-routing-v1',$4)`,
        [paymentId, reservationId, reference, createdAt],
      );
    }
    await owner.query(
      `INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details,created_at)
      SELECT gen_random_uuid(),$1,$2,'test.admin_records',$3||'-'||lpad(n::text,3,'0'),jsonb_build_object('detail',$3::text),
             '2020-01-01T00:00:00Z'::timestamptz+n*interval '1 second' FROM generate_series(0,204) AS n`,
      [adminId, businessId, prefix],
    );

    await t.test(
      'anonymous and non-admin accounts cannot read any collection, even with invalid filters',
      async () => {
        for (const collection of ['businesses', 'reservations', 'payments', 'audit']) {
          assert.equal((await anonymous(`/admin/records/${collection}?page=bad`)).status, 401);
          assert.equal((await customer(`/admin/records/${collection}?page=bad`)).status, 403);
        }
      },
    );
    await t.test(
      'business and audit searches reach records beyond the former 200-row limit',
      async () => {
        for (const collection of ['businesses', 'audit']) {
          const first = await admin<AdminRecordsPage<Business | Activity>>(
            `/admin/records/${collection}?q=${prefix}&page=1&pageSize=50`,
          );
          const last = await admin<AdminRecordsPage<Business | Activity>>(
            `/admin/records/${collection}?q=${prefix}&page=5&pageSize=50`,
          );
          assert.equal(first.status, 200, JSON.stringify(first));
          assert.equal(first.data.total, 205);
          assert.equal(first.data.items.length, 50);
          assert.equal(last.data.total, 205);
          assert.equal(last.data.items.length, 5);
          assert.equal(last.data.page, 5);
          assert.equal(last.data.pageSize, 50);
          assert.equal(
            new Set([...first.data.items, ...last.data.items].map((item) => item.id)).size,
            55,
          );
          const oldest = await admin<AdminRecordsPage<Business | Activity>>(
            `/admin/records/${collection}?q=${encodeURIComponent(`${prefix}${collection === 'businesses' ? ' ' : '-'}000`)}`,
          );
          assert.equal(oldest.data.total, 1);
          assert.equal(oldest.data.items.length, 1);
        }
      },
    );
    await t.test(
      'reservation and payment pagination searches snapshots, references and business scope',
      async () => {
        for (const collection of ['reservations', 'payments']) {
          const first: Result<AdminRecordsPage<Reservation | Payment>> = await admin(
            `/admin/records/${collection}?businessId=${businessId}&pageSize=2`,
          );
          const second: Result<AdminRecordsPage<Reservation | Payment>> = await admin(
            `/admin/records/${collection}?businessId=${businessId}&page=2&pageSize=2`,
          );
          assert.equal(first.status, 200, JSON.stringify(first));
          assert.equal(first.data.total, 3);
          assert.equal(first.data.items.length, 2);
          assert.equal(second.data.items.length, 1);
          const secondItem = second.data.items[0];
          assert.ok(secondItem);
          assert.ok(!first.data.items.some((item) => item.id === secondItem.id));
          const oldest = await admin<AdminRecordsPage<Reservation | Payment>>(
            `/admin/records/${collection}?q=${prefix}-0`,
          );
          assert.equal(oldest.data.total, 1);
          assert.equal(oldest.data.items.length, 1);
        }
      },
    );
    await t.test(
      'empty pages, literal search characters and valid status filters keep the page contract',
      async () => {
        for (const collection of ['businesses', 'reservations', 'payments', 'audit']) {
          const result = await admin<AdminRecordsPage<unknown>>(
            `/admin/records/${collection}?q=${prefix}-missing`,
          );
          assert.equal(result.status, 200, JSON.stringify(result));
          assert.deepEqual(result.data, { items: [], total: 0, page: 1, pageSize: 25 });
          const injection = await admin<AdminRecordsPage<unknown>>(
            `/admin/records/${collection}?q=${encodeURIComponent("' OR 1=1 --")}`,
          );
          assert.equal(injection.data.total, 0);
        }
        const status = await admin<AdminRecordsPage<Business>>(
          `/admin/records/businesses?q=${prefix}&status=APPROVED`,
        );
        assert.equal(status.data.total, 0);
        const outside = await admin<AdminRecordsPage<Business>>(
          `/admin/records/businesses?q=${prefix}&page=10`,
        );
        assert.equal(outside.data.total, 205);
        assert.deepEqual(outside.data.items, []);
      },
    );
    await t.test(
      'malformed, duplicate and unsupported filters fail before database selection',
      async () => {
        for (const query of [
          'page=0',
          'page=-1',
          'page=1.5',
          'page=10001',
          'page=1&page=2',
          'pageSize=51',
          'pageSize=0',
          'status=UNKNOWN',
          'businessId=not-a-uuid',
          `q=${'a'.repeat(161)}`,
          'surprise=value',
        ]) {
          const result = await admin(`/admin/records/businesses?${query}`);
          assert.equal(result.status, 422, `${query}: ${JSON.stringify(result)}`);
        }
        assert.equal((await admin('/admin/records/audit?status=PENDING')).status, 422);
      },
    );
    await t.test(
      'owners search their entire reservation history without any client tenant override',
      async () => {
        await owner.query(
          `WITH fixtures AS (
          SELECT gen_random_uuid() AS quote_id,gen_random_uuid() AS reservation_id,n FROM generate_series(0,204) AS n
        ), quoted AS (
          INSERT INTO seven.quotes(quote_id,user_id,offering_id,starts_at,ends_at,quantity,amounts,inventory_ids,expires_at,terms_snapshot)
          SELECT quote_id,$1,$2,now()+interval '1 day',now()+interval '1 day 2 hours',1,$3,'[]',now()+interval '1 day',
            jsonb_build_object('title',$5::text||' owner '||lpad(n::text,3,'0'),'kind','DINING','city','Uyo','startDate','2026-11-01','quantity',1)
          FROM fixtures RETURNING quote_id
        ) INSERT INTO seven.reservations(reservation_id,user_id,business_id,offering_id,quote_id,workflow_state_id,payment_state_id,expires_at,created_at)
          SELECT f.reservation_id,$1,$4,$2,f.quote_id,
            CASE WHEN f.n=0 THEN ${sid('CANCELLED')} ELSE ${sid('CONFIRMED')} END,${sid('UNPAID')},now()+interval '1 day',
            '2021-01-01T00:00:00Z'::timestamptz+f.n*interval '1 second'
          FROM fixtures f JOIN quoted q USING(quote_id)`,
          [customerId, offeringId, prices, businessId, prefix],
        );
        const path = '/business/records/reservations';
        assert.equal((await anonymous(`${path}?page=bad`)).status, 401);
        for (const request of [customer, admin, receptionist]) {
          assert.equal((await request(`${path}?page=bad`)).status, 403);
        }
        const overview = await businessOwner<BusinessOverview>('/business/overview');
        assert.equal(overview.status, 200, JSON.stringify(overview));
        assert.equal(overview.data.reservations.length, 200);
        assert.ok(!overview.data.reservations.some((item) => item.title === `${prefix} owner 000`));
        const first = await businessOwner<AdminRecordsPage<Reservation>>(`${path}?pageSize=50`);
        assert.equal(first.status, 200, JSON.stringify(first));
        assert.equal(first.data.total, 208);
        assert.equal(first.data.items.length, 50);
        assert.ok(first.data.items.every((item) => item.businessId === businessId));
        assert.ok(!first.data.items.some((item) => item.title === `${prefix} owner 000`));
        const last = await businessOwner<AdminRecordsPage<Reservation>>(
          `${path}?page=5&pageSize=50`,
        );
        assert.equal(last.data.items.length, 8);
        const oldest = await businessOwner<AdminRecordsPage<Reservation>>(
          `${path}?q=${encodeURIComponent(`${prefix} owner 000`)}&status=CANCELLED`,
        );
        assert.equal(oldest.data.total, 1);
        assert.equal(oldest.data.items[0]?.status, 'CANCELLED');
        const other = await otherOwner<AdminRecordsPage<Reservation>>(`${path}?q=${prefix}`);
        assert.deepEqual(other.data, { items: [], total: 0, page: 1, pageSize: 25 });
        for (const query of [
          `businessId=${otherBusinessId}`,
          'unknown=value',
          'status=PAID',
          'pageSize=51',
          'page=1&page=2',
        ]) {
          assert.equal((await businessOwner(`${path}?${query}`)).status, 422, query);
        }
        assert.equal((await otherOwner(`${path}?businessId=${businessId}`)).status, 422);
      },
    );
  } finally {
    const listener = server;
    if (listener)
      await new Promise<void>((resolve, reject) =>
        listener.close((error) => (error ? reject(error) : resolve())),
      );
    if (businessIds.length) {
      await owner.query('DELETE FROM seven.memberships WHERE business_id=ANY($1::uuid[])', [
        businessIds,
      ]);
      await owner.query(
        'DELETE FROM seven.payment_attempts WHERE reservation_id IN (SELECT reservation_id FROM seven.reservations WHERE business_id=ANY($1::uuid[]))',
        [businessIds],
      );
      await owner.query('DELETE FROM seven.reservations WHERE business_id=ANY($1::uuid[])', [
        businessIds,
      ]);
      await owner.query(
        'DELETE FROM seven.quotes WHERE offering_id IN (SELECT offering_id FROM seven.offerings WHERE business_id=ANY($1::uuid[]))',
        [businessIds],
      );
      await owner.query('DELETE FROM seven.offerings WHERE business_id=ANY($1::uuid[])', [
        businessIds,
      ]);
      await owner.query('DELETE FROM seven.audit_events WHERE business_id=ANY($1::uuid[])', [
        businessIds,
      ]);
      await owner.query('DELETE FROM seven.venues WHERE business_id=ANY($1::uuid[])', [
        businessIds,
      ]);
      await owner.query('DELETE FROM seven.businesses WHERE business_id=ANY($1::uuid[])', [
        businessIds,
      ]);
    }
    if (userIds.length) {
      for (const table of ['audit_events', 'idempotencies', 'sessions', 'notifications'])
        await owner.query(`DELETE FROM seven.${table} WHERE user_id=ANY($1::uuid[])`, [userIds]);
      await owner.query('DELETE FROM seven.users WHERE user_id=ANY($1::uuid[])', [userIds]);
    }
    await runtimePool.end();
    await owner.end();
  }
});
