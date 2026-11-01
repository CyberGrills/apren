import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import type { Pool } from 'pg';
import { REQUIRED_SCHEMA_MIGRATION, schemaIsReady } from '../../services/platform/src/schemaReadiness.ts';

interface ReadinessRow {
  migration_applied: boolean;
  booking_recovery_events_present: boolean;
  quote_recovery_session_column_present: boolean;
  recovery_policy_contract_present: boolean;
}

function fakePool(row?: ReadinessRow): Pick<Pool, 'query'> {
  return {
    query: async (sql: string, values?: unknown[]) => {
      assert.match(sql, /migration_name\s*=\s*\$1/);
      assert.match(sql, /to_regclass\('seven\.booking_recovery_events'\)/);
      assert.match(sql, /column_name\s*=\s*'recovery_session_id'/);
      assert.match(sql, /seven_app_server_access/);
      assert.match(sql, /seven_readonly_select_access/);
      assert.match(sql, /roles\s*=\s*ARRAY\['seven_app'\]::name\[\]/);
      assert.match(sql, /roles\s*=\s*ARRAY\['seven_readonly'\]::name\[\]/);
      assert.match(sql, /permissive\s*=\s*'PERMISSIVE'/);
      assert.match(sql, /lower\(btrim\(coalesce\(qual, ''\)\)\)\s*=\s*'true'/);
      assert.match(sql, /lower\(btrim\(coalesce\(with_check, ''\)\)\)\s*=\s*'true'/);
      assert.match(sql, /with_check IS NULL/);
      assert.deepEqual(values, [REQUIRED_SCHEMA_MIGRATION]);
      return { rows: row ? [row] : [] };
    },
  } as unknown as Pick<Pool, 'query'>;
}

test('schema readiness requires the migration, recovery table, quote column and scoped RLS policy contract', async () => {
  const complete = {
    migration_applied: true,
    booking_recovery_events_present: true,
    quote_recovery_session_column_present: true,
    recovery_policy_contract_present: true,
  };
  assert.equal(await schemaIsReady(fakePool(complete)), true);
  assert.equal(await schemaIsReady(fakePool({ ...complete, migration_applied: false })), false);
  assert.equal(await schemaIsReady(fakePool({ ...complete, booking_recovery_events_present: false })), false);
  assert.equal(await schemaIsReady(fakePool({ ...complete, quote_recovery_session_column_present: false })), false);
  assert.equal(await schemaIsReady(fakePool({ ...complete, recovery_policy_contract_present: false })), false);
  assert.equal(await schemaIsReady(fakePool()), false);
});

test('readiness marker matches the highest numbered migration in the repository', async () => {
  const files = (await readdir(new URL('../../database/migrations/', import.meta.url)))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();
  assert.ok(files.length > 0);
  assert.equal(files.at(-1), REQUIRED_SCHEMA_MIGRATION);
});

test('both API entry points use schema-aware readiness rather than an old ledger row', async () => {
  const api = await readFile(new URL('../../api/[...path].ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../services/platform/src/app.ts', import.meta.url), 'utf8');
  assert.match(api, /schemaIsReady\(pool\)/);
  assert.match(app, /schemaIsReady\(pool\)/);
  assert.doesNotMatch(api, /SELECT 1 FROM seven\.migrations LIMIT 1/);
  assert.doesNotMatch(app, /SELECT 1 FROM seven\.migrations LIMIT 1/);
});
