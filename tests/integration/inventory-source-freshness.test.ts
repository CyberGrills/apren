import assert from 'node:assert/strict';
import test from 'node:test';
import { createPool } from '../../backend/platform/src/db.ts';
import { migrate } from '../../backend/platform/src/migrate.ts';

test('inventory source freshness policy distinguishes manual, PMS, unknown, and invalid timestamps', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 60000,
}, async () => {
  const value = process.env.TEST_DATABASE_URL!;
  const url = new URL(value);
  assert.doesNotMatch(url.hostname, /(?:^|\\.)supabase\\.co$|(?:^|\\.)pooler\\.supabase\\.com$/i);
  assert.match(decodeURIComponent(url.pathname.slice(1)), /_test_db$/);
  const pool = createPool(value);
  try {
    const identity = await pool.query('SELECT current_database() AS name');
    assert.match(String(identity.rows[0]?.name), /_test_db$/);
    await migrate(pool);
    const result = await pool.query(`
      SELECT
        seven.inventory_window_is_fresh('PMS', now() - interval '4 minutes', 24, false) AS pms_fresh,
        seven.inventory_window_is_fresh('PMS', now() - interval '5 minutes', 24, false) AS pms_at_boundary,
        seven.inventory_window_is_fresh('PMS', now() - interval '6 minutes', 24, false) AS pms_stale,
        seven.inventory_window_is_fresh('PMS', now() + interval '1 second', 24, false) AS pms_future,
        seven.inventory_window_is_fresh('MANUAL', now() - interval '23 hours', 24, false) AS manual_fresh,
        seven.inventory_window_is_fresh('MANUAL', now() - interval '24 hours', 24, false) AS manual_at_boundary,
        seven.inventory_window_is_fresh('MANUAL', now() - interval '25 hours', 24, false) AS manual_stale,
        seven.inventory_window_is_fresh('MANUAL', now() - interval '167 hours', 168, false) AS manual_max_policy,
        seven.inventory_window_is_fresh('MANUAL', now(), 0, false) AS manual_invalid_policy,
        seven.inventory_window_is_fresh('UNKNOWN', now(), 24, false) AS unknown_source,
        seven.inventory_window_is_fresh('UNKNOWN', now() - interval '1 year', 0, true) AS local_sample
    `);
    assert.deepEqual(result.rows[0], {
      pms_fresh: true,
      pms_at_boundary: false,
      pms_stale: false,
      pms_future: false,
      manual_fresh: true,
      manual_at_boundary: false,
      manual_stale: false,
      manual_max_policy: true,
      manual_invalid_policy: false,
      unknown_source: false,
      local_sample: true,
    });
  } finally {
    await pool.end();
  }
});
