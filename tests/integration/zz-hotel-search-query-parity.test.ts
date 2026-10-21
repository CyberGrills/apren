import assert from 'node:assert/strict';
import test from 'node:test';
import { optimizeHotelBookings } from '@7even/engine';
import { createPool, one, rows, transaction } from '../../services/platform/src/db.ts';
import * as S from '../../services/platform/src/store.ts';

const batchSize = 200;
const rooms = 2;
const legacySql = "SELECT o.offering_id FROM seven.offerings o JOIN seven.businesses b USING(business_id) JOIN seven.sectors s USING(sector_id) WHERE o.is_published AND b.workflow_state_id=(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED') AND s.sector_code='STAY' AND (b.details->>'isSample'='true' OR b.details #>> '{verificationReview,checklistVersion}'='1') AND ($1='' OR lower(o.city) LIKE $1) AND EXISTS (SELECT 1 FROM seven.inventory_windows w WHERE w.offering_id=o.offering_id AND w.ends_at>now() AND w.capacity>w.allocated_count AND (w.starts_at+interval '1 hour')::date>=COALESCE($2::date,(now() AT TIME ZONE 'Africa/Lagos')::date) AND ($2::date IS NULL OR (w.starts_at+interval '1 hour')::date<COALESCE($3::date,$2::date+1))) AND ($2::date IS NULL OR (SELECT count(DISTINCT (w.starts_at+interval '1 hour')::date) FROM seven.inventory_windows w WHERE w.offering_id=o.offering_id AND w.ends_at>now() AND w.capacity-w.allocated_count>=$4 AND (w.starts_at+interval '1 hour')::date>=$2::date AND (w.starts_at+interval '1 hour')::date<COALESCE($3::date,$2::date+1))=(COALESCE($3::date,$2::date+1)-$2::date)) AND ($5::uuid IS NULL OR o.offering_id>$5::uuid) ORDER BY o.offering_id LIMIT $6";
const groupedSql = "WITH raw_batch AS (SELECT o.offering_id FROM seven.offerings o JOIN seven.businesses b USING(business_id) JOIN seven.sectors s USING(sector_id) WHERE o.is_published AND b.workflow_state_id=(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED') AND s.sector_code='STAY' AND (b.details->>'isSample'='true' OR b.details #>> '{verificationReview,checklistVersion}'='1') AND ($1='' OR lower(o.city) LIKE $1) AND ($5::uuid IS NULL OR o.offering_id>$5::uuid) ORDER BY o.offering_id LIMIT $6), inventory_by_offering AS (SELECT w.offering_id,bool_or(w.ends_at>now() AND w.capacity>w.allocated_count) AS has_available_window,count(DISTINCT (w.starts_at+interval '1 hour')::date) FILTER (WHERE w.ends_at>now() AND w.capacity-w.allocated_count>=$4) AS nights_with_capacity FROM seven.inventory_windows w JOIN raw_batch rb USING(offering_id) WHERE (w.starts_at+interval '1 hour')::date>=COALESCE($2::date,(now() AT TIME ZONE 'Africa/Lagos')::date) AND ($2::date IS NULL OR (w.starts_at+interval '1 hour')::date<COALESCE($3::date,$2::date+1)) GROUP BY w.offering_id) SELECT rb.offering_id,(COALESCE(ibo.has_available_window,false) AND ($2::date IS NULL OR COALESCE(ibo.nights_with_capacity,0)=(COALESCE($3::date,$2::date+1)-$2::date))) AS eligible FROM raw_batch rb LEFT JOIN inventory_by_offering ibo USING(offering_id) ORDER BY rb.offering_id";

function lagosDateOffset(days: number): string {
  const value = new Date(Date.now() + days * 86400000);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const part = (name: string) => parts.find((entry) => entry.type === name)?.value ?? '';
  return part('year') + '-' + part('month') + '-' + part('day');
}

type CandidateRow = { offering_id: string; eligible?: boolean };

async function scan(db: Parameters<typeof rows>[0], sql: string, city: string, start: string | null, end: string | null) {
  let cursor: string | null = null;
  const ids: string[] = [];
  let queries = 0;
  const began = performance.now();
  while (true) {
    const found: CandidateRow[] = await rows<CandidateRow>(db, sql, [city, start, end, rooms, cursor, batchSize]);
    queries++;
    if (found.length === 0) break;
    for (const row of found) if (row.eligible === undefined || row.eligible) ids.push(String(row.offering_id));
    cursor = String(found[found.length - 1]!.offering_id);
    if (found.length < batchSize) break;
  }
  return { ids, queries, elapsedMs: performance.now() - began };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;
}

test('legacy correlated and grouped hotel eligibility match on the same isolated PostgreSQL fixture', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 120000,
}, async () => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  try {
    const dbName = await one<{ db: string }>(pool, 'SELECT current_database() AS db');
    assert.match(dbName?.db ?? '', /_test_db$/, 'Benchmark may only use the disposable _test_db database.');
    const start = lagosDateOffset(7);
    // This benchmark owns its fixture: the broader integration test cleans up its
    // own synthetic rows, and test-file execution order must not be a dependency.
    await pool.query(
      `INSERT INTO seven.offerings
         (offering_id,business_id,sector_id,title,description,city,price_minor,is_published,details)
       SELECT gen_random_uuid(), approved.business_id,
              (SELECT sector_id FROM seven.sectors WHERE sector_code='STAY'),
              'Scale synthetic hotel ' || series,
              'Disposable benchmark-only listing',
              'Lagos', 100000 + series * 1000, true,
              jsonb_build_object('capacity', 3)
       FROM (
         SELECT business_id FROM seven.businesses
         WHERE workflow_state_id=(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED')
         ORDER BY business_id LIMIT 1
       ) approved
       CROSS JOIN generate_series(1,1105) AS seq(series)`,
    );
    await pool.query(
      `INSERT INTO seven.offerings
         (offering_id,business_id,sector_id,title,description,city,price_minor,is_published,details)
       SELECT gen_random_uuid(), approved.business_id,
              (SELECT sector_id FROM seven.sectors WHERE sector_code='STAY'),
              'Scale ineligible hotel ' || series,
              'Disposable benchmark-only listing without inventory',
              'Lagos', 50000 + series * 1000, true,
              jsonb_build_object('capacity', 3)
       FROM (
         SELECT business_id FROM seven.businesses
         WHERE workflow_state_id=(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED')
         ORDER BY business_id LIMIT 1
       ) approved
       CROSS JOIN generate_series(1,175) AS seq(series)`,
    );
    await pool.query(
      `INSERT INTO seven.inventory_windows
         (inventory_window_id,offering_id,starts_at,ends_at,capacity)
       SELECT gen_random_uuid(), o.offering_id,
              ($1::date + night_offset + time '13:00') AT TIME ZONE 'UTC',
              ($1::date + night_offset + 1 + time '10:00') AT TIME ZONE 'UTC',
              3
       FROM seven.offerings o
       CROSS JOIN generate_series(0,1) AS nights(night_offset)
       WHERE o.title LIKE 'Scale synthetic hotel %'`,
      [start],
    );
    try {
      await transaction(pool, async (db) => {
        await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        const fixture = await one<{ total: number }>(db, "SELECT count(*)::int AS total FROM seven.offerings WHERE title LIKE 'Scale % hotel %'");
        assert.ok((fixture?.total ?? 0) >= 1280, 'Expected 1,105 eligible scale listings plus 175 no-inventory listings.');
      const scenarios = [
        { name: 'no-date', start: null, end: null, city: '%lagos%' },
        { name: 'single-night', start, end: null, city: '%lagos%' },
        { name: 'two-night', start, end: lagosDateOffset(9), city: '%lagos%' },
        { name: 'missing-third-night', start, end: lagosDateOffset(10), city: '%lagos%' },
        { name: 'city-substring-no-match', start, end: null, city: '%city-that-does-not-exist%' },
      ];
      for (const scenario of scenarios) {
        const legacy = await scan(db, legacySql, scenario.city, scenario.start, scenario.end);
        const grouped = await scan(db, groupedSql, scenario.city, scenario.start, scenario.end);
        assert.deepEqual(grouped.ids, legacy.ids, 'Candidate ID/order parity failed for ' + scenario.name);
        if (scenario.name === 'single-night') {
          // Run the same production ranking policy against each strategy's
          // independently retrieved candidates, not just the candidate IDs.
          const legacyOffers = await S.offeringProjections(db, legacy.ids, true);
          const groupedOffers = await S.offeringProjections(db, grouped.ids, true);
          const criteria = {
            checkInDate: start,
            checkOutDate: lagosDateOffset(8),
            rooms,
            city: 'Lagos',
            amenities: [] as string[],
            asOf: new Date().toISOString(),
          };
          const rank = (offers: typeof legacyOffers) => optimizeHotelBookings(
            offers.map((offer) => ({
              id: offer.id,
              title: offer.title,
              city: offer.city,
              priceMinor: offer.priceMinor,
              amenities: offer.amenities,
              windows: offer.windows,
            })),
            criteria,
          ).map((item) => ({
            id: item.id,
            matchScore: item.matchScore,
            estimatedBaseTotalMinor: item.estimatedBaseTotalMinor,
            roomsAvailable: item.roomsAvailable,
            reasons: item.reasons,
            policyVersion: item.policyVersion,
          }));
          assert.deepEqual(rank(groupedOffers), rank(legacyOffers), 'Ranked hotel IDs, order, scores, and reasons must match.');
        }
      }
      const legacyTimes: number[] = [];
      const groupedTimes: number[] = [];
      let expected: string[] = [];
      let groupedQueries = 0;
      for (let i = 0; i < 7; i++) {
        const legacy = await scan(db, legacySql, '%lagos%', start, null);
        const grouped = await scan(db, groupedSql, '%lagos%', start, null);
        assert.deepEqual(grouped.ids, legacy.ids, 'Candidate sets diverged during paired benchmark.');
        if (i === 0) expected = legacy.ids;
        else { legacyTimes.push(legacy.elapsedMs); groupedTimes.push(grouped.elapsedMs); }
        groupedQueries = grouped.queries;
      }
      const oldPlan = await rows<{ 'QUERY PLAN': Array<{ Plan?: { 'Actual Total Time'?: number } }> }>(db, 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + legacySql, ['%lagos%', start, null, rooms, null, batchSize]);
      const newPlan = await rows<{ 'QUERY PLAN': Array<{ Plan?: { 'Actual Total Time'?: number } }> }>(db, 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + groupedSql, ['%lagos%', start, null, rooms, null, batchSize]);
      assert.ok(oldPlan.length && newPlan.length, 'Both EXPLAIN ANALYZE plans must be collected.');
      console.info(JSON.stringify({
        event: 'seven.hotel_search.same_fixture_query_benchmark',
        fixtureScaleListings: fixture?.total ?? 0,
        candidateCount: expected.length,
        queryCountPerStrategy: groupedQueries,
        repeatsAfterWarmup: legacyTimes.length,
        legacyP50Ms: Number(percentile(legacyTimes, 0.5).toFixed(2)),
        legacyP95Ms: Number(percentile(legacyTimes, 0.95).toFixed(2)),
        groupedP50Ms: Number(percentile(groupedTimes, 0.5).toFixed(2)),
        groupedP95Ms: Number(percentile(groupedTimes, 0.95).toFixed(2)),
        legacyPlanMs: oldPlan[0]?.['QUERY PLAN']?.[0]?.Plan?.['Actual Total Time'] ?? null,
        groupedPlanMs: newPlan[0]?.['QUERY PLAN']?.[0]?.Plan?.['Actual Total Time'] ?? null,
        candidateParity: 'exact-id-and-order',
        rankingParity: 'verified-exact-ranked-output',
      }));
      });
    } finally {
      await pool.query("DELETE FROM seven.inventory_windows WHERE offering_id IN (SELECT offering_id FROM seven.offerings WHERE title LIKE 'Scale % hotel %')");
      await pool.query("DELETE FROM seven.offerings WHERE title LIKE 'Scale % hotel %'");
    }
  } finally {
    await pool.end();
  }
});
