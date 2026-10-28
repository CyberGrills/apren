import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import type { Pool } from 'pg';
import { REQUIRED_SCHEMA_MIGRATION, schemaIsReady } from '../../services/platform/src/schemaReadiness.ts';

function fakePool(row: { migration_applied: boolean; booking_recovery_events_present: boolean; quote_recovery_session_column_present: boolean } | undefined): Pick<Pool, 'query'> {
  return {
    query: async (sql: string, values?: unknown[]) => {
      assert.match(sql, /migration_name\s*=\s*\$1/);
      assert.match(sql, /to_regclass\('seven\.booking_recovery_events'\)/);
      assert.match(sql, /column_name='recovery_session_id'/);
      assert.deepEqual(values, [REQUIRED_SCHEMA_MIGRATION]);
      return { rows: row ? [row] : [] };
    },
  } as unknown as Pick<Pool, 'query'>;
}

test('schema readiness requires the latest migration and booking-recovery table', async () => {
  assert.equal(await schemaIsReady(fakePool({ migration_applied: true, booking_recovery_events_present: true, quote_recovery_session_column_present: true })), true);
  assert.equal(await schemaIsReady(fakePool({ migration_applied: false, booking_recovery_events_present: true, quote_recovery_session_column_present: true })), false);
  assert.equal(await schemaIsReady(fakePool({ migration_applied: true, booking_recovery_events_present: false, quote_recovery_session_column_present: true })), false);
  assert.equal(await schemaIsReady(fakePool({ migration_applied: true, booking_recovery_events_present: true, quote_recovery_session_column_present: false })), false);
  assert.equal(await schemaIsReady(fakePool(undefined)), false);
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
