import assert from 'node:assert/strict';
import test from 'node:test';
import { createPool } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';

function assertDisposableDatabaseUrl(value: string): URL {
  const parsed = new URL(value);
  assert.doesNotMatch(
    parsed.hostname,
    /(?:^|\.)supabase\.co$|(?:^|\.)pooler\.supabase\.com$/i,
    'TEST_DATABASE_URL must never point to a Supabase project.',
  );
  assert.match(
    decodeURIComponent(parsed.pathname.slice(1)),
    /_test_db$/,
    'TEST_DATABASE_URL database name must end in _test_db.',
  );
  return parsed;
}

test(
  'internal seven tables have RLS and policies matching existing server-role grants',
  { skip: !process.env.TEST_DATABASE_URL, timeout: 90000 },
  async () => {
    const parsed = assertDisposableDatabaseUrl(process.env.TEST_DATABASE_URL!);
    const pool = createPool(process.env.TEST_DATABASE_URL!);
    try {
      const db = await pool.query('SELECT current_database() AS db');
      assert.equal(
        db.rows[0]?.db,
        decodeURIComponent(parsed.pathname.slice(1)),
        'Connected database must match TEST_DATABASE_URL.',
      );
      await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
      await migrate(pool);

      const audit = await pool.query<{
        table_name: string;
        rls_enabled: boolean;
        app_has_privilege: boolean;
        app_policy: boolean;
        readonly_has_select: boolean;
        readonly_policy: boolean;
      }>(`
        SELECT
          c.relname AS table_name,
          c.relrowsecurity AS rls_enabled,
          (
            has_table_privilege('seven_app', c.oid, 'SELECT')
            OR has_table_privilege('seven_app', c.oid, 'INSERT')
            OR has_table_privilege('seven_app', c.oid, 'UPDATE')
            OR has_table_privilege('seven_app', c.oid, 'DELETE')
          ) AS app_has_privilege,
          EXISTS (
            SELECT 1 FROM pg_policy p
            WHERE p.polrelid = c.oid
              AND p.polname = 'seven_app_server_access'
          ) AS app_policy,
          has_table_privilege('seven_readonly', c.oid, 'SELECT') AS readonly_has_select,
          EXISTS (
            SELECT 1 FROM pg_policy p
            WHERE p.polrelid = c.oid
              AND p.polname = 'seven_readonly_select_access'
          ) AS readonly_policy
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'seven'
          AND c.relkind IN ('r', 'p')
        ORDER BY c.relname
      `);

      assert.ok(audit.rows.length > 0, 'seven schema tables must exist after migrations.');
      for (const table of audit.rows) {
        assert.equal(table.rls_enabled, true, `${table.table_name} must have RLS enabled.`);
        if (table.app_has_privilege)
          assert.equal(table.app_policy, true, `${table.table_name} needs the seven_app policy.`);
        if (table.readonly_has_select)
          assert.equal(table.readonly_policy, true, `${table.table_name} needs the seven_readonly SELECT policy.`);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE seven_app');
        await client.query('SELECT count(*) FROM seven.businesses');
        const update = await client.query(
          'UPDATE seven.businesses SET updated_at = updated_at WHERE false',
        );
        assert.equal(update.rowCount, 0, 'No-op UPDATE must not modify production-style fixture rows.');
        await client.query('ROLLBACK');

        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE seven_readonly');
        await client.query('SELECT count(*) FROM seven.businesses');
        await client.query('ROLLBACK');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  },
);
