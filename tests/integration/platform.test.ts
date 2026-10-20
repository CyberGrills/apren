import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type * as C from '@7even/contracts';
import { createApp } from '../../services/platform/src/app.ts';
import { createPool, one, rows, transaction } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import {
  applyReceipt,
  checkout as createCheckout,
  reconcileSettlements,
  requestRefund,
  verifyPayment,
} from '../../services/platform/src/payments.ts';
import type { PaymentProvider } from '../../services/platform/src/provider.ts';
import { MockProvider, minorToDecimal } from '../../services/platform/src/provider.ts';
import { providerIds } from '../../services/platform/src/providerRegistry.ts';
import { seed } from '../../services/platform/src/seed.ts';
import {
  pointsProjection,
  reservationProjection,
  safePoints,
} from '../../services/platform/src/store.ts';
import { processInbox, processOutbox, recoverClaims } from '../../services/platform/src/worker.ts';

const origin = 'http://localhost:5177';
const password = 'Integration-only-passphrase-42!';

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
  base: string;
  cookie = '';
  csrf = '';
  constructor(base: string) {
    this.base = base;
  }
  async request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    key: string = randomUUID(),
  ): Promise<Result<T>> {
    const response = await fetch(`${this.base}/api${path}`, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: this.cookie,
        'X-CSRF-Token': this.csrf,
        'Idempotency-Key': key,
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
  async login(email: string): Promise<C.SessionUser> {
    const r = await this.request<C.SessionData>('/auth/login', 'POST', { email, password });
    assert.equal(r.status, 200, JSON.stringify(r));
    this.csrf = r.data.csrfToken!;
    return r.data.user!;
  }
}

test('7even real PostgreSQL API and invariant acceptance', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 120000,
}, async (t) => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  const dbName = await one(pool, 'SELECT current_database() AS db');
  assert.match(
    dbName?.db,
    /_test_db$/,
    'Destructive test reset only permitted in the isolated test database.',
  );
  await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
  await migrate(pool);
  await seed(pool, password);
  const appPool = process.env.TEST_RUNTIME_DATABASE_URL
    ? createPool(process.env.TEST_RUNTIME_DATABASE_URL)
    : pool;
  if (process.env.TEST_RUNTIME_DATABASE_URL) {
    const runtimePrivileges = await one(
      appPool,
      `SELECT current_user AS role,
              has_schema_privilege(current_user, 'seven', 'USAGE') AS schema_usage,
              pg_has_role(current_user, 'seven_app', 'USAGE') AS app_privileges`,
    );
    assert.equal(
      runtimePrivileges?.schema_usage,
      true,
      `TEST_RUNTIME_DATABASE_URL login ${runtimePrivileges?.role ?? '(unknown)'} must inherit seven_app so it has USAGE on schema seven.`,
    );
    assert.equal(
      runtimePrivileges?.app_privileges,
      true,
      `TEST_RUNTIME_DATABASE_URL login ${runtimePrivileges?.role ?? '(unknown)'} must inherit the seven_app group role.`,
    );
  }
  const provider = new MockProvider();
  const runtime = createApp({ pool: appPool, provider, environment: 'test', publicOrigin: origin });
  const server = await new Promise<Server>((resolve) => {
    const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const guest = new Client(base);
  const friend = new Client(base);
  const host = new Client(base);
  const receptionist = new Client(base);
  const admin = new Client(base);
  try {
    const guestUser = await guest.login('guest@seven.test');
    const friendUser = await friend.login('friend@seven.test');
    const hostUser = await host.login('host@seven.test');
    const receptionUser = await receptionist.login('reception@seven.test');
    await admin.login('admin@seven.test');
    let offered: C.Offering;
    let reservation: C.Reservation;
    let pay: C.Payment;
    let fulfillKey: string;
    let checkoutKey: string;
    await t.test(
      'all overview routes exercise their real SQL and return scoped records',
      async () => {
        for (const [client, path] of [
          [guest, '/me/overview'],
          [host, '/business/overview'],
          [receptionist, '/reception/overview'],
          [admin, '/admin/overview'],
        ] as const) {
          const r = await client.request(path);
          assert.equal(r.status, 200, JSON.stringify(r));
        }
        const publicOffers = await guest.request<C.Offering[]>('/offerings');
        assert.equal(publicOffers.status, 200);
        assert.equal(publicOffers.data.length, 3);
        assert.ok(publicOffers.data.every((o) => o.windows.length === 45 && o.isSample));

        const engineHealth = await guest.request<{
          engine: string;
          status: string;
          inventorySource: string;
          publishedHotelOffers: number;
          policyVersion: string;
        }>('/engine/booking/health');
        assert.equal(engineHealth.status, 200, JSON.stringify(engineHealth));
        assert.equal(engineHealth.data.engine, '7even-hotel-booking-engine');
        assert.equal(engineHealth.data.status, 'ok');
        assert.equal(engineHealth.data.inventorySource, 'postgresql-live');
        assert.ok(engineHealth.data.publishedHotelOffers >= 1);
        assert.equal(engineHealth.data.policyVersion, '7even-hotel-ranking-v1');

        const checkIn = lagosDateOffset(7);
        const checkOut = calendarDateOffset(checkIn, 2);
        const syntheticOffers = await rows<{ offering_id: string }>(
          pool,
          `INSERT INTO seven.offerings
             (offering_id,business_id,sector_id,title,description,city,price_minor,is_published,details)
           SELECT gen_random_uuid(), approved.business_id,
                  (SELECT sector_id FROM seven.sectors WHERE sector_code='STAY'),
                  'Scale synthetic hotel ' || series,
                  'Isolated performance-test listing',
                  'Lagos', 100000 + series * 1000, true,
                  jsonb_build_object('amenities', jsonb_build_array('Wi-Fi'), 'capacity', 3)
           FROM (
             SELECT business_id FROM seven.businesses
             WHERE workflow_state_id=(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED')
             ORDER BY business_id LIMIT 1
           ) approved
           CROSS JOIN generate_series(1,1105) AS seq(series)
           RETURNING offering_id`,
        );
        assert.equal(syntheticOffers.length, 1105, 'isolated scale fixture must contain 1,105 hotels');
        await pool.query(
          `INSERT INTO seven.inventory_windows
             (inventory_window_id,offering_id,starts_at,ends_at,capacity)
           SELECT gen_random_uuid(), offer_id,
                  (\$1::date + night_offset + time '13:00') AT TIME ZONE 'UTC',
                  (\$1::date + night_offset + 1 + time '10:00') AT TIME ZONE 'UTC',
                  3
           FROM unnest(\$2::uuid[]) AS offers(offer_id)
           CROSS JOIN generate_series(0,1) AS nights(night_offset)`,
          [checkIn, syntheticOffers.map((item) => item.offering_id)],
        );

        const explain = await rows<{ 'QUERY PLAN': unknown }>(
          pool,
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
           SELECT o.offering_id
           FROM seven.offerings o
           JOIN seven.businesses b USING(business_id)
           JOIN seven.sectors s USING(sector_id)
           WHERE o.is_published
             AND b.workflow_state_id=(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED')
             AND s.sector_code='STAY'
             AND lower(o.city) LIKE \$1
             AND EXISTS (
               SELECT 1 FROM seven.inventory_windows w
               WHERE w.offering_id=o.offering_id AND w.ends_at>now()
                 AND w.capacity>w.allocated_count
                 AND (w.starts_at + interval '1 hour')::date>=\$2::date
                 AND (w.starts_at + interval '1 hour')::date<\$3::date
             )
             AND (SELECT count(DISTINCT (w.starts_at + interval '1 hour')::date)
                  FROM seven.inventory_windows w
                  WHERE w.offering_id=o.offering_id AND w.ends_at>now()
                    AND w.capacity-w.allocated_count>=\$4
                    AND (w.starts_at + interval '1 hour')::date>=\$2::date
                    AND (w.starts_at + interval '1 hour')::date<\$3::date)
                 = (\$3::date - \$2::date)
           ORDER BY o.offering_id LIMIT \$5`,
          ['%lagos%', checkIn, checkOut, 2, 200],
        );
        assert.ok(explain.length > 0 && explain[0]?.['QUERY PLAN'], 'EXPLAIN ANALYZE plan must be captured');
        console.info(JSON.stringify({
          event: 'seven.hotel_search.synthetic_query_plan',
          queryPlan: explain[0]?.['QUERY PLAN'],
        }));

        const searchDurations: number[] = [];
        let benchmarkIds: string[] = [];
        for (let attempt = 0; attempt < 5; attempt++) {
          const startedAt = performance.now();
          const benchmark = await guest.request<C.Offering[]>(
            `/offerings?kind=STAY&city=Lagos&startDate=${checkIn}&endDate=${checkOut}&rooms=2&pageSize=10`,
          );
          searchDurations.push(performance.now() - startedAt);
          assert.equal(benchmark.status, 200, JSON.stringify(benchmark));
          assert.equal(benchmark.data.length, 10);
          assert.ok(benchmark.data.every((hotel) => (hotel.bookingOptimization?.roomsAvailable ?? 0) >= 2));
          const ids = benchmark.data.map((hotel) => hotel.id);
          if (attempt === 0) benchmarkIds = ids;
          else assert.deepEqual(ids, benchmarkIds, 'repeated searches must return deterministic top results');
        }
        const sortedDurations = [...searchDurations].sort((a, b) => a - b);
        const p50Ms = Math.round(sortedDurations[2]! * 100) / 100;
        const p95Ms = Math.round(sortedDurations[4]! * 100) / 100;
        console.info(JSON.stringify({
          event: 'seven.hotel_search.synthetic_benchmark',
          eligibleSyntheticHotels: syntheticOffers.length,
          batchSize: 200,
          samples: searchDurations.length,
          p50Ms,
          p95Ms,
          queryPlanCaptured: true,
        }));
        assert.ok(p95Ms < 5000, `synthetic hotel search p95 exceeded 5s: ${p95Ms}ms`);
        const cheapestSynthetic = await one<{ offering_id: string }>(
          pool,
          "SELECT offering_id FROM seven.offerings WHERE title='Scale synthetic hotel 1'",
        );
        assert.equal(benchmarkIds[0], cheapestSynthetic?.offering_id, 'lowest-priced eligible synthetic hotel must remain in the global top results');

        const optimizedHotels = await guest.request<C.Offering[]>(
          `/offerings?kind=STAY&startDate=${checkIn}&endDate=${checkOut}&rooms=2`,
        );
        assert.equal(optimizedHotels.status, 200, JSON.stringify(optimizedHotels));
        assert.ok(optimizedHotels.data.length >= 1);
        assert.ok(optimizedHotels.data.every((hotel) =>
          hotel.kind === 'STAY'
          && hotel.bookingOptimization?.checkInDate === checkIn
          && hotel.bookingOptimization?.checkOutDate === checkOut
          && hotel.bookingOptimization?.roomsRequested === 2
          && (hotel.bookingOptimization?.matchScore ?? -1) >= 0
          && (hotel.bookingOptimization?.matchScore ?? 101) <= 100,
        ));
        const impossibleRooms = await guest.request<C.Offering[]>(
          `/offerings?kind=STAY&startDate=${checkIn}&endDate=${checkOut}&rooms=9`,
        );
        assert.equal(impossibleRooms.status, 200);
        assert.deepEqual(impossibleRooms.data, []);

        const stay = publicOffers.data.find((offering) => offering.kind === 'STAY');
        assert.ok(stay);
        const pastQuote = await guest.request('/quotes', 'POST', {
          offeringId: stay.id,
          startDate: lagosDateOffset(-2),
          endDate: lagosDateOffset(-1),
          quantity: 1,
        });
        assert.equal(pastQuote.status, 422);
        assert.equal(pastQuote.error?.code, 'PAST_CHECK_IN');

        assert.equal((await guest.request('/admin/overview')).status, 403);
        assert.equal((await friend.request('/business/overview')).status, 403);
        const invalid = await new Client(base).request('/auth/register', 'POST', {
          email: 'invalid@example.test',
          displayName: 'Invalid',
          password,
          role: 'ADMIN',
        });
        assert.equal(invalid.status, 422);
      },
    );
    await t.test('20 independent quote/hold races allocate the last unit once', async () => {
      const response = await host.request<C.Offering>('/business/offerings', 'POST', {
        title: 'Last room test',
        description: 'A synthetic integration fixture with exactly one unit.',
        kind: 'STAY',
        city: 'Lagos',
        address: 'Test venue, Lagos',
        priceMinor: '100000',
        capacity: 1,
        published: true,
      });
      assert.equal(response.status, 200, JSON.stringify(response));
      offered = response.data;
      const startDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      const endDate = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
      assert.equal(
        (
          await host.request(`/business/offerings/${offered.id}/availability`, 'POST', {
            startDate,
            endDate,
            capacity: 1,
          })
        ).status,
        200,
      );
      const quotes = await Promise.all(
        Array.from({ length: 20 }, () =>
          guest.request<C.Quote>('/quotes', 'POST', {
            offeringId: offered.id,
            startDate,
            endDate,
            quantity: 1,
          }),
        ),
      );
      assert.ok(
        quotes.every((q) => q.status === 200),
        JSON.stringify(quotes.find((q) => q.status !== 200)),
      );
      const holds = await Promise.all(
        quotes.map((q) =>
          guest.request<C.Reservation>('/reservations', 'POST', { quoteId: q.data.id }),
        ),
      );
      assert.equal(holds.filter((h) => h.status === 200).length, 1, JSON.stringify(holds));
      assert.equal(holds.filter((h) => h.status === 409).length, 19);
      reservation = holds.find((h) => h.status === 200)!.data;
      const capacity = await one(
        pool,
        'SELECT capacity,allocated_count FROM seven.inventory_windows WHERE offering_id=$1',
        [offered.id],
      );
      assert.equal(capacity?.allocated_count, 1);
      assert.equal((await friend.request(`/reservations/${reservation.id}`)).status, 403);
    });
    await t.test(
      'checkout completion, webhook-equivalent requery and once-only accepted-policy points',
      async () => {
        checkoutKey = randomUUID();
        const checkout = await guest.request<C.Checkout>(
          `/reservations/${reservation.id}/checkout`,
          'POST',
          {},
          checkoutKey,
        );
        assert.equal(checkout.status, 200, JSON.stringify(checkout));
        assert.equal(checkout.data.mode, 'mock');
        const paid = await guest.request<C.Payment>(
          `/payments/${checkout.data.paymentId}/dev-complete`,
          'POST',
          { outcome: 'SUCCESS' },
        );
        assert.equal(paid.status, 200, JSON.stringify(paid));
        pay = paid.data;
        assert.equal(pay.status, 'PAID');
        assert.equal(pay.settlementStatus, 'UNSETTLED');
        const pkey = randomUUID();
        const completions = await Promise.all(
          Array.from({ length: 10 }, () =>
            guest.request(`/payments/${pay.id}/dev-complete`, 'POST', { outcome: 'SUCCESS' }, pkey),
          ),
        );
        assert.ok(completions.every((r) => r.status === 200));
        const jr = await rows(
          pool,
          'SELECT * FROM seven.money_journals WHERE source_reference=$1',
          [`receipt:${pay.provider}:local-${pay.id}`],
        );
        assert.equal(jr.length, 1);
        await admin.request('/admin/policy', 'POST', {
          earnSpendMinor: '100',
          earnPoints: 1000,
          holdMinutes: 15,
          reason: 'Verify accepted policy does not change retroactively.',
        });
        reservation = (await guest.request<C.Reservation>(`/reservations/${reservation.id}`)).data;
        fulfillKey = randomUUID();
        const fulfillment = await receptionist.request<C.Reservation>(
          `/reservations/${reservation.id}/actions`,
          'POST',
          { action: 'FULFILL', expectedRevision: reservation.revision },
          fulfillKey,
        );
        assert.equal(fulfillment.status, 200, JSON.stringify(fulfillment));
        assert.equal(fulfillment.data.status, 'FULFILLED');
        assert.equal(
          (
            await receptionist.request(
              `/reservations/${reservation.id}/actions`,
              'POST',
              { action: 'FULFILL', expectedRevision: reservation.revision },
              fulfillKey,
            )
          ).status,
          200,
        );
        const points = await pointsProjection(pool, guestUser.id);
        assert.equal(points.balance, 1010, 'Original rate10per100000, not new1000per100');
        const provenance = await one(
          pool,
          'SELECT bool_and(is_synthetic) AS synthetic FROM seven.observations WHERE business_id=$1',
          [hostUser.businessId],
        );
        assert.equal(
          provenance?.synthetic,
          true,
          'Interactions with sample businesses cannot become market-demand evidence.',
        );
        const balance = await one(
          pool,
          'SELECT sum(amount_minor) AS total FROM seven.money_postings',
        );
        assert.equal(balance?.total, '0');
      },
    );
    await t.test(
      '20 redemptions cannot overspend1000 points and gifts rotate ownership claims',
      async () => {
        const rewards = (await friend.request<C.Reward[]>('/rewards')).data;
        const reward = rewards[0]!;
        const results = await Promise.all(
          Array.from({ length: 20 }, () =>
            friend.request<C.Benefit>(`/rewards/${reward.id}/redeem`, 'POST', {}),
          ),
        );
        assert.equal(results.filter((r) => r.status === 200).length, 10);
        assert.equal(results.filter((r) => r.status === 409).length, 10);
        assert.equal((await pointsProjection(pool, friendUser.id)).balance, 0);
        const benefit = results.find((r) => r.status === 200)!.data;
        const trade = await friend.request<C.Trade>('/trades', 'POST', {
          benefitId: benefit.id,
          recipientEmail: guestUser.email,
        });
        assert.equal(trade.status, 200, JSON.stringify(trade));
        const accepted = await guest.request<C.Trade>(`/trades/${trade.data.id}/actions`, 'POST', {
          action: 'ACCEPT',
          expectedRevision: trade.data.revision,
        });
        assert.equal(accepted.status, 200, JSON.stringify(accepted));
        const overview = (await guest.request<C.CustomerOverview>('/me/overview')).data;
        const received = overview.benefits.find((b) => b.id === benefit.id)!;
        assert.equal(received.ownerId, guestUser.id);
        assert.notEqual(received.redemptionCode, benefit.redemptionCode);
        assert.equal(
          (
            await friend.request('/trades', 'POST', {
              benefitId: benefit.id,
              recipientEmail: guestUser.email,
            })
          ).status,
          409,
        );
        const sum = await one(pool, 'SELECT sum(points) AS total FROM seven.points_postings');
        assert.equal(sum?.total, '0');
      },
    );
    await t.test('points projection never silently rounds an unsafe integer', () => {
      assert.equal(safePoints('9007199254740991'), Number.MAX_SAFE_INTEGER);
      assert.throws(() => safePoints('9007199254740993'));
    });
    await t.test(
      'dining and experience slot adapters serialize 20 last-seat requests',
      async () => {
        for (const kind of ['DINING', 'EXPERIENCE'] as const) {
          const created = await host.request<C.Offering>('/business/offerings', 'POST', {
            title: `Last ${kind.toLowerCase()} seat`,
            description: 'A synthetic last-seat concurrency acceptance fixture.',
            kind,
            city: 'Lagos',
            address: 'Isolated test venue, Lagos',
            priceMinor: '10000',
            capacity: 1,
            published: true,
          });
          assert.equal(created.status, 200, JSON.stringify(created));
          const startDate = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
          const available = await host.request<C.Offering>(
            `/business/offerings/${created.data.id}/availability`,
            'POST',
            {
              startDate,
              startAt: `${startDate}T18:00:00+01:00`,
              endAt: `${startDate}T20:00:00+01:00`,
              capacity: 1,
            },
          );
          assert.equal(available.status, 200, JSON.stringify(available));
          const window = available.data.windows[0]!;
          const quotes = await Promise.all(
            Array.from({ length: 20 }, () =>
              guest.request<C.Quote>('/quotes', 'POST', {
                offeringId: created.data.id,
                startDate,
                windowId: window.id,
                quantity: 1,
              }),
            ),
          );
          assert.ok(quotes.every((q) => q.status === 200));
          const reservations = await Promise.all(
            quotes.map((q) =>
              guest.request<C.Reservation>('/reservations', 'POST', { quoteId: q.data.id }),
            ),
          );
          assert.equal(reservations.filter((r) => r.status === 200).length, 1, kind);
          assert.equal(reservations.filter((r) => r.status === 409).length, 19, kind);
          assert.equal(
            (
              await one(
                pool,
                'SELECT allocated_count FROM seven.inventory_windows WHERE inventory_window_id=$1',
                [window.id],
              )
            )?.allocated_count,
            1,
          );
        }
      },
    );
    await t.test(
      'a held reservation keeps the quote-accepted hold policy when current policy changes',
      async () => {
        const current = (await admin.request<C.AdminOverview>('/admin/overview')).data.policy;
        assert.equal(
          (
            await admin.request('/admin/policy', 'POST', {
              earnSpendMinor: current.earnSpendMinor,
              earnPoints: current.earnPoints,
              holdMinutes: 5,
              reason: 'Set isolated accepted hold policy fixture.',
            })
          ).status,
          200,
        );
        const startDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        const endDate = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
        await host.request(`/business/offerings/${offered.id}/availability`, 'POST', {
          startDate,
          endDate,
          capacity: 1,
        });
        const quote = await guest.request<C.Quote>('/quotes', 'POST', {
          offeringId: offered.id,
          startDate,
          endDate,
          quantity: 1,
        });
        assert.equal(quote.status, 200, JSON.stringify(quote));
        assert.equal(
          (
            await admin.request('/admin/policy', 'POST', {
              earnSpendMinor: current.earnSpendMinor,
              earnPoints: current.earnPoints,
              holdMinutes: 60,
              reason: 'Change current policy after quote acceptance.',
            })
          ).status,
          200,
        );
        const held = await guest.request<C.Reservation>('/reservations', 'POST', {
          quoteId: quote.data.id,
        });
        assert.equal(held.status, 200, JSON.stringify(held));
        const duration = await one(
          pool,
          'SELECT extract(epoch FROM expires_at-created_at)::int AS duration FROM seven.reservations WHERE reservation_id=$1',
          [held.data.id],
        );
        assert.equal(duration?.duration, 300, 'The accepted five-minute policy remains binding.');
        assert.equal(
          (
            await admin.request('/admin/policy', 'POST', {
              earnSpendMinor: current.earnSpendMinor,
              earnPoints: current.earnPoints,
              holdMinutes: current.holdMinutes,
              reason: 'Restore the pre-fixture current policy.',
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      'extra successful charge preserves funding booking and refunds original suspense accounts',
      async () => {
        const receiptId = `extra-${randomUUID()}`;
        const receipt = {
          id: receiptId,
          reference: pay.reference,
          status: 'successful',
          currency: 'NGN',
          amountMinor: Number(pay.amountMinor),
          feeMinor: 0,
        };
        const extra = await transaction(appPool, (db) =>
          applyReceipt(db, receipt, null, pay.provider),
        );
        assert.equal(extra.status, 'REVIEW_REQUIRED');
        assert.equal((await reservationProjection(pool, reservation.id))?.paymentId, pay.id);
        assert.equal(
          (await transaction(appPool, (db) => applyReceipt(db, receipt, null, pay.provider))).id,
          extra.id,
          'Redelivery of an already recorded excess charge resolves to that same payment.',
        );
        const refunded = await requestRefund(
          appPool,
          provider,
          hostUser,
          reservation.id,
          'Duplicate successful customer charge',
          extra.id,
        );
        assert.equal(refunded.status, 'REFUNDED');
        assert.equal((await reservationProjection(pool, reservation.id))?.paymentStatus, 'PAID');
        const suspense = await one(
          pool,
          'SELECT coalesce(sum(amount_minor),0) AS total FROM seven.money_postings WHERE account_code=$1',
          [`unallocated:${extra.id}`],
        );
        assert.equal(suspense?.total, '0');
      },
    );
    await t.test('late verified payment after expiry never revives capacity', async () => {
      const listing = (await guest.request<C.Offering[]>('/offerings?kind=DINING')).data[0]!;
      const window = listing.windows.find(
        (w) => new Date(w.startAt).getTime() > Date.now() + 86400000,
      )!;
      const quote = await guest.request<C.Quote>('/quotes', 'POST', {
        offeringId: listing.id,
        startDate: window.serviceDate,
        windowId: window.id,
        quantity: 1,
      });
      assert.equal(quote.status, 200);
      const held = await guest.request<C.Reservation>('/reservations', 'POST', {
        quoteId: quote.data.id,
      });
      assert.equal(held.status, 200);
      assert.equal(
        (await guest.request(`/reservations/${held.data.id}/checkout`, 'POST', {}, checkoutKey))
          .status,
        409,
        'Caller key cannot initialize a different reservation checkout',
      );
      const checkout = await guest.request<C.Checkout>(
        `/reservations/${held.data.id}/checkout`,
        'POST',
        {},
      );
      assert.equal(checkout.status, 200);
      await pool.query(
        "UPDATE seven.reservations SET expires_at=now()-interval '1 second' WHERE reservation_id=$1",
        [held.data.id],
      );
      const late = await guest.request<C.Payment>(
        `/payments/${checkout.data.paymentId}/dev-complete`,
        'POST',
        { outcome: 'SUCCESS' },
      );
      assert.equal(late.status, 200);
      const r = await reservationProjection(pool, held.data.id);
      assert.equal(r?.status, 'PAYMENT_REVIEW');
      const inventory = await one(
        pool,
        'SELECT allocated_count FROM seven.inventory_windows WHERE inventory_window_id=$1',
        [window.id],
      );
      assert.equal(inventory?.allocated_count, 0);
    });
    await t.test(
      'a durable inbox survives acknowledgment-before-crash and competing workers',
      async () => {
        const extraId = `inbox-extra-${randomUUID()}`;
        const eventId = randomUUID();
        provider.receipts.set(pay.reference, {
          id: extraId,
          reference: pay.reference,
          status: 'successful',
          currency: 'NGN',
          amountMinor: Number(pay.amountMinor),
          feeMinor: 0,
        });
        await pool.query(
          'INSERT INTO seven.provider_events(provider_event_id,event_reference,event_code,details,payment_provider_id) VALUES($1,$2,$3,$4,$5)',
          [
            eventId,
            `charge.completed:${extraId}`,
            'charge.completed',
            { id: extraId, reference: pay.reference },
            providerIds[pay.provider],
          ],
        );
        const processed = await Promise.all([
          processInbox(pool, provider),
          processInbox(pool, provider),
        ]);
        assert.equal(
          processed.reduce((a, b) => a + b, 0),
          1,
        );
        const event = await one(
          pool,
          'SELECT * FROM seven.provider_events WHERE provider_event_id=$1',
          [eventId],
        );
        assert.ok(event?.processed_at);
        assert.equal(event?.attempts, 1);
        assert.equal(
          (
            await rows(pool, 'SELECT * FROM seven.money_journals WHERE source_reference=$1', [
              `receipt:${pay.provider}:${extraId}`,
            ])
          ).length,
          1,
        );
        assert.equal((await reservationProjection(pool, reservation.id))?.paymentId, pay.id);
        const before = Number(
          (await one(pool, 'SELECT count(*) AS total FROM seven.notifications'))?.total,
        );
        await Promise.all([processOutbox(pool), processOutbox(pool)]);
        const after = Number(
          (await one(pool, 'SELECT count(*) AS total FROM seven.notifications'))?.total,
        );
        assert.ok(after > before);
        await processOutbox(pool);
        assert.equal(
          Number((await one(pool, 'SELECT count(*) AS total FROM seven.notifications'))?.total),
          after,
          'Outbox retry cannot duplicate notification effects',
        );
      },
    );
    await t.test(
      'reception sync persists application, deduplicates and exposes revision conflicts',
      async () => {
        const listing = (await guest.request<C.Offering[]>('/offerings?kind=EXPERIENCE')).data[0]!;
        const window = listing.windows.find(
          (w) => new Date(w.startAt).getTime() > Date.now() + 86400000,
        )!;
        const q = await guest.request<C.Quote>('/quotes', 'POST', {
          offeringId: listing.id,
          startDate: window.serviceDate,
          windowId: window.id,
          quantity: 1,
        });
        assert.equal(q.status, 200);
        const held = await guest.request<C.Reservation>('/reservations', 'POST', {
          quoteId: q.data.id,
        });
        assert.equal(held.status, 200);
        assert.equal(
          (await receptionist.request(`/reservations/${held.data.id}`)).status,
          403,
          'Reception cannot read a different business',
        );
        const own = (await guest.request<C.Offering[]>('/offerings?kind=STAY')).data.find(
          (o) => o.businessId === hostUser.businessId,
        )!;
        const ownWindow = own.windows.find(
          (w) => new Date(w.startAt).getTime() > Date.now() + 86400000,
        )!;
        const ownDate = ownWindow.serviceDate;
        const ownEnd = new Date(Date.parse(`${ownDate}T00:00:00Z`) + 86400000)
          .toISOString()
          .slice(0, 10);
        const ownQuote = await guest.request<C.Quote>('/quotes', 'POST', {
          offeringId: own.id,
          startDate: ownDate,
          endDate: ownEnd,
          quantity: 1,
        });
        const ownHold = await guest.request<C.Reservation>('/reservations', 'POST', {
          quoteId: ownQuote.data.id,
        });
        const checkout = await guest.request<C.Checkout>(
          `/reservations/${ownHold.data.id}/checkout`,
          'POST',
          {},
        );
        await guest.request(`/payments/${checkout.data.paymentId}/dev-complete`, 'POST', {
          outcome: 'SUCCESS',
        });
        const r = (await guest.request<C.Reservation>(`/reservations/${ownHold.data.id}`)).data;
        const overview = (await receptionist.request<C.ReceptionOverview>('/reception/overview'))
          .data;
        const event = {
          eventId: randomUUID(),
          schemaVersion: 1,
          reservationId: r.id,
          expectedRevision: r.revision,
          action: 'CHECK_IN',
          occurredAt: new Date().toISOString(),
        };
        const first = await receptionist.request<C.SyncResult>('/reception/sync', 'POST', {
          sourceId: overview.sourceId,
          events: [event],
        });
        assert.equal(first.status, 200, JSON.stringify(first));
        assert.equal(first.data.outcomes[0]?.status, 'APPLIED');
        const repeat = await receptionist.request<C.SyncResult>('/reception/sync', 'POST', {
          sourceId: overview.sourceId,
          events: [event],
        });
        assert.equal(repeat.data.outcomes[0]?.status, 'DUPLICATE');
        const stale = { ...event, eventId: randomUUID(), action: 'FULFILL' };
        const conflict = await receptionist.request<C.SyncResult>('/reception/sync', 'POST', {
          sourceId: overview.sourceId,
          events: [stale],
        });
        assert.equal(conflict.data.outcomes[0]?.status, 'CONFLICT');
        assert.equal(
          (await guest.request<C.Reservation>(`/reservations/${r.id}`)).data.status,
          'CHECKED_IN',
        );
      },
    );
    await t.test(
      'a provider refund amount mismatch stays unknown and is never blindly reissued',
      async () => {
        const review = await one(
          pool,
          "SELECT reservation_id FROM seven.reservations WHERE workflow_state_id=(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='PAYMENT_REVIEW') ORDER BY created_at LIMIT 1",
        );
        assert.ok(review);
        const original = provider.refund.bind(provider);
        let calls = 0;
        provider.refund = async () => {
          calls++;
          return { id: 'wrong-amount-refund', status: 'completed-bank-transfer', amountMinor: 1 };
        };
        const adminUser = (await admin.request<C.SessionData>('/auth/session')).data.user!;
        try {
          const refunded = await requestRefund(
            pool,
            provider,
            adminUser,
            review.reservation_id,
            'Test mismatched refund evidence',
          );
          assert.equal(refunded.status, 'REFUND_PENDING');
          await requestRefund(
            pool,
            provider,
            adminUser,
            review.reservation_id,
            'Same operation retry',
          );
          assert.equal(calls, 1);
          const intent = await one(
            pool,
            'SELECT r.*,s.workflow_state_code FROM seven.refunds r JOIN seven.workflow_states s USING(workflow_state_id) WHERE payment_attempt_id=$1',
            [refunded.id],
          );
          assert.equal(intent?.workflow_state_code, 'UNKNOWN');
          assert.equal(
            (
              await rows(pool, 'SELECT * FROM seven.money_journals WHERE source_reference=$1', [
                `refund:${intent?.refund_id}`,
              ])
            ).length,
            0,
          );
        } finally {
          provider.refund = original;
        }
      },
    );
    await t.test(
      'settlement requires exact transaction, approved bank and net fee evidence',
      async () => {
        const created = await host.request<C.Offering>('/business/offerings', 'POST', {
          title: 'Flutterwave settlement evidence fixture',
          description: 'A synthetic high-value stay with an approved frozen bank destination.',
          kind: 'STAY',
          city: 'Lagos',
          address: 'Isolated test venue, Lagos',
          priceMinor: '10000000',
          capacity: 1,
          published: true,
        });
        assert.equal(created.status, 200, JSON.stringify(created));
        const startDate = new Date(Date.now() + 22 * 86400000).toISOString().slice(0, 10);
        const endDate = new Date(Date.now() + 23 * 86400000).toISOString().slice(0, 10);
        assert.equal(
          (
            await host.request(`/business/offerings/${created.data.id}/availability`, 'POST', {
              startDate,
              endDate,
              capacity: 1,
            })
          ).status,
          200,
        );
        const quote = await guest.request<C.Quote>('/quotes', 'POST', {
          offeringId: created.data.id,
          startDate,
          endDate,
          quantity: 1,
        });
        assert.equal(quote.status, 200, JSON.stringify(quote));
        const held = await guest.request<C.Reservation>('/reservations', 'POST', {
          quoteId: quote.data.id,
        });
        assert.equal(held.status, 200, JSON.stringify(held));
        const account = await one(
          pool,
          'SELECT * FROM seven.business_payment_accounts WHERE business_id=$1 AND payment_provider_id=$2',
          [hostUser.businessId, providerIds.flutterwave],
        );
        assert.ok(account);
        const fixture = Object.create(provider) as PaymentProvider;
        fixture.mode = 'flutterwave';
        await pool.query(
          "UPDATE seven.business_payment_accounts SET execution_mode_id=(SELECT execution_mode_id FROM seven.execution_modes WHERE execution_mode_code='flutterwave'),revision=revision+1,details=details||$3::jsonb WHERE business_id=$1 AND payment_provider_id=$2",
          [
            hostUser.businessId,
            providerIds.flutterwave,
            { settlementAccount: '0000000001', settlementBankCode: '044' },
          ],
        );
        try {
          const checkout = await createCheckout(appPool, fixture, guestUser, held.data.id, origin);
          assert.equal(checkout.provider, 'flutterwave');
          const transactionId = `settlement-fixture-${randomUUID()}`;
          provider.receipts.set(checkout.reference, {
            id: transactionId,
            reference: checkout.reference,
            status: 'successful',
            currency: 'NGN',
            amountMinor: Number(held.data.price.totalMinor),
            feeMinor: 0,
          });
          const pay = await verifyPayment(appPool, fixture, guestUser, checkout.reference);
          assert.equal(pay.status, 'PAID');
          await assert.rejects(
            appPool.query(
              'UPDATE seven.payment_attempts SET provider_details=provider_details||\'{"mode":"mock"}\'::jsonb WHERE payment_attempt_id=$1',
              [pay.id],
            ),
            /immutable/,
          );
          await assert.rejects(
            appPool.query(
              'UPDATE seven.payment_attempts SET provider_details=provider_details||\'{"settlementAccount":"9999999999"}\'::jsonb WHERE payment_attempt_id=$1',
              [pay.id],
            ),
            /immutable/,
          );
          let lookupCalls = 0;
          fixture.settlements = async () => {
            lookupCalls++;
            throw new Error('Synthetic provider outage.');
          };
          assert.equal((await reconcileSettlements(pool, fixture)).exceptions, 1);
          const failedLookup = await one(
            pool,
            'SELECT settlement_checks,next_settlement_check_at,provider_details FROM seven.payment_attempts WHERE payment_attempt_id=$1',
            [pay.id],
          );
          assert.equal(
            failedLookup?.settlement_checks,
            1,
            'A failed external lookup consumes its durable attempt.',
          );
          assert.ok(
            new Date(failedLookup?.next_settlement_check_at).getTime() > Date.now() + 14 * 60000,
          );
          await reconcileSettlements(pool, fixture);
          assert.equal(lookupCalls, 1, 'The next worker tick respects persisted provider backoff.');
          await pool.query(
            'UPDATE seven.payment_attempts SET next_settlement_check_at=now() WHERE payment_attempt_id=$1',
            [pay.id],
          );
          const detail: Record<string, unknown> = {
            id: 'test-settlement',
            currency: 'NGN',
            status: 'completed',
            queriedSubaccount: (await one(
              pool,
              'SELECT business_subaccount FROM seven.payment_attempts WHERE payment_attempt_id=$1',
              [pay.id],
            ))!.business_subaccount,
            settlement_account: '0000000001',
            bank_code: '044',
            destination: 'account',
            disburse_ref: 'test-disbursement',
            processed_date: new Date().toISOString(),
            transactions: [
              {
                id: pay.providerTransactionId,
                tx_ref: pay.reference,
                currency: 'NGN',
                status: 'successful',
                app_fee: '1.00',
                merchant_fee: 0,
                stampduty_charge: 0,
                settlement_amount: '0.01',
              },
            ],
          };
          fixture.settlements = async () => [detail];
          assert.equal((await reconcileSettlements(pool, fixture)).exceptions, 1);
          assert.equal(
            (
              await one(
                pool,
                'SELECT s.workflow_state_code FROM seven.payment_attempts p JOIN seven.workflow_states s ON s.workflow_state_id=p.settlement_state_id WHERE payment_attempt_id=$1',
                [pay.id],
              )
            )?.workflow_state_code,
            'FLAGGED',
          );
          (detail.transactions as Record<string, unknown>[])[0]!.settlement_amount = minorToDecimal(
            Number(pay.amountMinor) - Number(pay.commissionMinor) - 100,
          );
          await pool.query(
            'UPDATE seven.payment_attempts SET next_settlement_check_at=now() WHERE payment_attempt_id=$1',
            [pay.id],
          );
          assert.equal((await reconcileSettlements(pool, fixture)).processed, 1);
          const settled = await guest.request<C.Payment>(`/payments/${pay.id}`);
          assert.equal(settled.data.settlementStatus, 'SETTLED');
          assert.equal(settled.data.feeMinor, '100');
          assert.equal(
            (
              await one(
                pool,
                'SELECT sum(p.amount_minor) AS total FROM seven.money_postings p JOIN seven.money_journals j USING(money_journal_id) WHERE p.account_code=$1 AND j.source_reference=ANY($2::varchar[])',
                [
                  `business:${hostUser.businessId}`,
                  [
                    `receipt:flutterwave:${pay.providerTransactionId}`,
                    `fee:flutterwave:${pay.providerTransactionId}`,
                    `settlement-fee:${pay.id}`,
                    `settlement:test-settlement:${pay.id}`,
                  ],
                ],
              )
            )?.total,
            '0',
          );
        } finally {
          await pool.query(
            'UPDATE seven.business_payment_accounts SET execution_mode_id=$3,revision=$4,details=$5 WHERE business_id=$1 AND payment_provider_id=$2',
            [
              hostUser.businessId,
              providerIds.flutterwave,
              account.execution_mode_id,
              account.revision,
              account.details,
            ],
          );
        }
      },
    );
    await t.test(
      'completed-service refund preserves history and records a nonspendable spent-points shortfall',
      async () => {
        const points = await pointsProjection(pool, guestUser.id);
        const reward = await host.request<C.Reward>('/business/rewards', 'POST', {
          title: 'Spend sample balance',
          description: 'A synthetic reward to test post-refund shortfall.',
          pointsCost: points.balance,
          capacity: 2,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          transferable: false,
          published: true,
        });
        assert.equal(reward.status, 200, JSON.stringify(reward));
        assert.equal(
          (await guest.request(`/rewards/${reward.data.id}/redeem`, 'POST', {})).status,
          200,
        );
        const refunded = await requestRefund(
          pool,
          provider,
          hostUser,
          reservation.id,
          'Reviewed completed-service goodwill refund',
        );
        assert.equal(refunded.status, 'REFUNDED');
        const after = await pointsProjection(pool, guestUser.id);
        assert.equal(after.balance, -10);
        assert.equal(after.available, 0);
        assert.equal(after.shortfall, 10);
        assert.equal((await reservationProjection(pool, reservation.id))?.status, 'FULFILLED');
        assert.equal(
          (await guest.request(`/rewards/${reward.data.id}/redeem`, 'POST', {})).status,
          409,
        );
        assert.equal(
          (
            await requestRefund(
              pool,
              provider,
              hostUser,
              reservation.id,
              'Same reviewed refund retry',
            )
          ).status,
          'REFUNDED',
        );
        assert.equal((await pointsProjection(pool, guestUser.id)).balance, -10);
      },
    );
    await t.test(
      'venue CRUD, scoped walk-in notes and admin operational controls use real records',
      async () => {
        const initial = await host.request<C.Venue[]>('/business/venues');
        assert.equal(initial.status, 200);
        assert.equal(initial.data.length, 1);
        const created = await host.request<C.Venue>('/business/venues', 'POST', {
          venueName: 'Temporary test venue',
          address: 'An isolated integration address',
          city: 'Lagos',
          timeZone: 'Africa/Lagos',
        });
        assert.equal(created.status, 200, JSON.stringify(created));
        const updated = await host.request<C.Venue>(
          `/business/venues/${created.data.id}`,
          'PATCH',
          {
            venueName: 'Updated test venue',
            address: 'An isolated integration address',
            city: 'Lagos',
            timeZone: 'Africa/Lagos',
            expectedRevision: created.data.revision,
          },
        );
        assert.equal(updated.status, 200);
        assert.equal(
          (
            await host.request(`/business/venues/${created.data.id}`, 'PATCH', {
              venueName: 'Stale venue edit',
              address: 'An isolated integration address',
              city: 'Lagos',
              timeZone: 'Africa/Lagos',
              expectedRevision: created.data.revision,
            })
          ).status,
          409,
        );
        assert.equal((await guest.request('/business/venues')).status, 403);
        assert.equal(
          (await host.request(`/business/venues/${created.data.id}`, 'DELETE', {})).status,
          200,
        );
        const reception = (await receptionist.request<C.ReceptionOverview>('/reception/overview'))
          .data;
        const offering = reception.offerings.find(
          (o) =>
            o.kind === 'STAY' &&
            o.id !== offered.id &&
            o.windows.some((w) => w.remaining > 0 && Date.parse(w.startAt) > Date.now() + 86400000),
        );
        assert.ok(offering, 'The walk-in fixture needs an unallocated future room.');
        const window = offering.windows.find(
          (w) => w.remaining > 0 && Date.parse(w.startAt) > Date.now() + 86400000,
        );
        assert.ok(window);
        const endDate = new Date(Date.parse(`${window.serviceDate}T00:00:00Z`) + 86400000)
          .toISOString()
          .slice(0, 10);
        const quote = await receptionist.request<C.Quote>('/quotes', 'POST', {
          offeringId: offering.id,
          startDate: window.serviceDate,
          endDate,
          quantity: 1,
        });
        assert.equal(quote.status, 200);
        const walkIn = await receptionist.request<C.Reservation>('/reception/walk-ins', 'POST', {
          quoteId: quote.data.id,
          customerEmail: 'walkin-fixture@seven.test',
          customerName: 'Synthetic walk-in',
        });
        assert.equal(walkIn.status, 200, JSON.stringify(walkIn));
        const before = Number(
          (await one(pool, 'SELECT count(*) AS total FROM seven.money_journals'))?.total,
        );
        const note = await receptionist.request<C.PaymentNote>(
          `/reception/reservations/${walkIn.data.id}/payment-notes`,
          'POST',
          {
            amountMinor: '10000',
            method: 'CASH',
            note: 'Staff assertion only, not provider verification.',
          },
        );
        assert.equal(note.status, 200, JSON.stringify(note));
        assert.equal(note.data.method, 'CASH');
        assert.equal(
          (await guest.request(`/reception/reservations/${walkIn.data.id}/payment-notes`)).status,
          403,
        );
        const unchanged = await reservationProjection(pool, walkIn.data.id);
        assert.equal(unchanged?.paymentStatus, 'UNPAID');
        assert.equal(unchanged?.status, 'HELD');
        assert.equal(
          Number((await one(pool, 'SELECT count(*) AS total FROM seven.money_journals'))?.total),
          before,
        );
        const operations = await admin.request<C.AdminOperations>('/admin/operations');
        assert.equal(operations.status, 200, JSON.stringify(operations));
        assert.ok(operations.data.sources.some((s) => s.id === reception.sourceId));
        assert.ok(operations.data.health.syncConflicts >= 1);
        assert.equal(
          (
            await admin.request(`/admin/sources/${reception.sourceId}/status`, 'POST', {
              active: false,
              reason: 'Isolated device pause test',
            })
          ).status,
          200,
        );
        const event = {
          eventId: randomUUID(),
          schemaVersion: 1,
          reservationId: walkIn.data.id,
          expectedRevision: walkIn.data.revision,
          action: 'CANCEL',
          occurredAt: new Date().toISOString(),
          reason: 'Test rejected source',
        };
        assert.equal(
          (
            await receptionist.request('/reception/sync', 'POST', {
              sourceId: reception.sourceId,
              events: [event],
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await admin.request(`/admin/sources/${reception.sourceId}/status`, 'POST', {
              active: true,
              reason: 'Restore isolated device fixture',
            })
          ).status,
          200,
        );
        const reward = operations.data.rewards[0]!;
        assert.equal(
          (
            await admin.request(`/admin/rewards/${reward.id}/moderation`, 'POST', {
              published: false,
              reason: 'Synthetic moderation test',
            })
          ).status,
          200,
        );
        assert.ok(
          !(await guest.request<C.Reward[]>('/rewards')).data.some((r) => r.id === reward.id),
        );
        assert.equal(
          (
            await admin.request(`/admin/rewards/${reward.id}/moderation`, 'POST', {
              published: true,
              reason: 'Restore synthetic test reward',
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      'abandoned durable claims recover observed results without rerunning financial effects',
      async () => {
        const recoveredKey = randomUUID();
        const interruptedKey = randomUUID();
        await pool.query(
          "INSERT INTO seven.idempotencies(idempotency_id,user_id,operation_key,operation_name,payload_hash,response_body,created_at) VALUES($1,$2,$3,$4,$5,$6,now()-interval '3 minutes'),($7,$2,$8,$9,$5,$6,now()-interval '3 minutes')",
          [
            randomUUID(),
            guestUser.id,
            recoveredKey,
            `POST:/api/payments/${pay.id}/dev-complete`,
            '0'.repeat(64),
            { __pending: true },
            randomUUID(),
            interruptedKey,
            `POST:/api/reservations/${randomUUID()}/checkout`,
          ],
        );
        const before = Number(
          (await one(pool, 'SELECT count(*) AS total FROM seven.money_journals'))?.total,
        );
        assert.equal(await recoverClaims(pool), 2);
        const recovered = await one(
          pool,
          'SELECT response_body FROM seven.idempotencies WHERE operation_key=$1',
          [recoveredKey],
        );
        assert.equal(recovered?.response_body.id, pay.id);
        const interrupted = await one(
          pool,
          'SELECT response_body FROM seven.idempotencies WHERE operation_key=$1',
          [interruptedKey],
        );
        assert.equal(interrupted?.response_body.__error.code, 'INTERRUPTED_OPERATION');
        assert.equal(
          Number((await one(pool, 'SELECT count(*) AS total FROM seven.money_journals'))?.total),
          before,
        );
      },
    );
    await t.test('venue-restricted reception cannot see or mutate a sibling venue', async () => {
      const venueId = randomUUID();
      await pool.query(
        'INSERT INTO seven.venues(venue_id,business_id,venue_name,address_line,city) VALUES($1,$2,$3,$4,$5)',
        [venueId, hostUser.businessId, 'Restricted test venue', 'Test only', 'Lagos'],
      );
      await pool.query('UPDATE seven.memberships SET venue_id=$1 WHERE user_id=$2', [
        venueId,
        receptionUser.id,
      ]);
      await receptionist.login('reception@seven.test');
      const session = await receptionist.request<C.SessionData>('/auth/session');
      assert.deepEqual(session.data.user?.venueIds, [venueId]);
      assert.equal((await receptionist.request(`/reservations/${reservation.id}`)).status, 403);
      assert.equal(
        (
          await receptionist.request(
            `/reservations/${reservation.id}/actions`,
            'POST',
            { action: 'FULFILL', expectedRevision: reservation.revision },
            fulfillKey,
          )
        ).status,
        403,
      );
    });
    await t.test('revoked staff cannot replay cached private mutation response', async () => {
      assert.equal(
        (await host.request(`/business/staff/${receptionUser.id}`, 'DELETE', {})).status,
        200,
      );
      await receptionist.login('reception@seven.test');
      const replay = await receptionist.request(
        `/reservations/${reservation.id}/actions`,
        'POST',
        { action: 'FULFILL', expectedRevision: reservation.revision },
        fulfillKey,
      );
      assert.equal(replay.status, 403, JSON.stringify(replay));
    });
    await t.test(
      'committed financial journals reject mutation at the database boundary',
      async () => {
        const posting = (await one(
          pool,
          'SELECT money_posting_id FROM seven.money_postings LIMIT 1',
        ))!;
        await assert.rejects(
          pool.query(
            'UPDATE seven.money_postings SET amount_minor=amount_minor+1 WHERE money_posting_id=$1',
            [posting.money_posting_id],
          ),
          /immutable/,
        );
        await assert.rejects(
          transaction(pool, async (db) => {
            const journalId = randomUUID();
            await db.query(
              "INSERT INTO seven.money_journals(money_journal_id,source_reference,currency_code,description) VALUES($1,$2,'NGN','Invalid test')",
              [journalId, `unbalanced:${journalId}`],
            );
            await db.query(
              "INSERT INTO seven.money_postings(money_posting_id,money_journal_id,account_code,amount_minor) VALUES($1,$2,'invalid',1)",
              [randomUUID(), journalId],
            );
          }),
          /Unbalanced/,
        );
      },
    );
    await t.test(
      'configured runtime login cannot create schema objects or delete retained business records',
      { skip: !process.env.TEST_RUNTIME_DATABASE_URL },
      async () => {
        const role = await one(
          appPool,
          'SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls FROM pg_roles r WHERE rolname=current_user',
        );
        assert.deepEqual(role, {
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolbypassrls: false,
        });
        await assert.rejects(
          appPool.query('CREATE TABLE seven.forbidden_runtime_ddl (id integer)'),
          /permission denied/,
        );
        await assert.rejects(
          appPool.query('DELETE FROM seven.businesses WHERE false'),
          /permission denied/,
        );
        await assert.rejects(
          appPool.query('UPDATE seven.money_postings SET amount_minor=amount_minor WHERE false'),
          /permission denied/,
        );
      },
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (appPool !== pool) await appPool.end();
    await pool.end();
  }
});
