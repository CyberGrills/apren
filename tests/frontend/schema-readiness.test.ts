import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import type { Pool } from 'pg';
import { CUSTOMER_PROFILE_MEDIA_MIGRATION, customerProfileMediaSchemaIsReady, isCustomerProfileMediaRoute, REQUIRED_SCHEMA_MIGRATION, schemaIsReady } from '../../backend/platform/src/schemaReadiness.ts';

interface ReadinessRow {
  migration_applied: boolean;
  booking_recovery_events_present: boolean;
  quote_recovery_session_column_present: boolean;
  recovery_policy_contract_present: boolean;
  demo_marketplace_schema_present: boolean;
}

function fakePool(row?: ReadinessRow): Pick<Pool, 'query'> {
  return {
    query: async (sql: string, values?: unknown[]) => {
      assert.match(sql, /migration_name\s*=\s*\$1/);
      assert.match(sql, /to_regclass\('seven\.booking_recovery_events'\)/);
      assert.match(sql, /to_regclass\('seven\.demo_catalog_items'\)/);
      assert.match(sql, /to_regclass\('seven\.demo_wallets'\)/);
      assert.match(sql, /to_regclass\('seven\.demo_bookings'\)/);
      assert.match(sql, /to_regclass\('seven\.demo_wallet_entries'\)/);
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

test('schema readiness requires the recovery contract and only requires demo schema outside production', async () => {
  const complete = {
    migration_applied: true,
    demo_marketplace_schema_present: true,
    booking_recovery_events_present: true,
    quote_recovery_session_column_present: true,
    recovery_policy_contract_present: true,
  };
  assert.equal(REQUIRED_SCHEMA_MIGRATION, '026_quote_recovery_session_attribution.sql');
  assert.equal(await schemaIsReady(fakePool(complete), 'production'), true);
  assert.equal(await schemaIsReady(fakePool(complete), 'preview'), true);
  assert.equal(await schemaIsReady(fakePool({ ...complete, demo_marketplace_schema_present: false }), 'production'), true);
  assert.equal(await schemaIsReady(fakePool({ ...complete, demo_marketplace_schema_present: false }), 'preview'), false);
  assert.equal(await schemaIsReady(fakePool({ ...complete, migration_applied: false }), 'production'), false);
  assert.equal(await schemaIsReady(fakePool({ ...complete, booking_recovery_events_present: false })), false);
  assert.equal(await schemaIsReady(fakePool({ ...complete, quote_recovery_session_column_present: false })), false);
  assert.equal(await schemaIsReady(fakePool({ ...complete, recovery_policy_contract_present: false })), false);
  assert.equal(await schemaIsReady(fakePool(), 'production'), false);
});

test('readiness marker references an existing numbered migration', async () => {
  const files = (await readdir(new URL('../../database/migrations/', import.meta.url)))
    .filter((file) => /^\d+.*\.sql$/.test(file));
  assert.ok(files.length > 0);
  assert.ok(files.includes(REQUIRED_SCHEMA_MIGRATION));
  assert.ok(files.includes(CUSTOMER_PROFILE_MEDIA_MIGRATION));
});

test('both API entry points use schema-aware readiness rather than an old ledger row', async () => {
  const api = await readFile(new URL('../../backend/api/[...path].ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../backend/platform/src/app.ts', import.meta.url), 'utf8');
  assert.match(api, /schemaIsReady\(pool,\s*environment\)/);
  assert.match(app, /schemaIsReady\(pool,\s*environment\)/);
  assert.doesNotMatch(api, /SELECT 1 FROM seven\.migrations LIMIT 1/);
  assert.doesNotMatch(app, /SELECT 1 FROM seven\.migrations LIMIT 1/);
  assert.match(app, /isCustomerProfileMediaRoute\\(req\\.path\\)/);
  assert.match(app, /PROFILE_MEDIA_SCHEMA_NOT_READY/);
});


interface ProfileMediaReadinessRow {
  migration_applied: boolean;
  table_ready: boolean;
  app_policy_ready: boolean;
  readonly_policy_ready: boolean;
}

function fakeProfileMediaPool(row?: ProfileMediaReadinessRow): Pick<Pool, 'query'> {
  return {
    query: async (sql: string, values?: unknown[]) => {
      assert.match(sql, /customer_profile_media/);
      assert.match(sql, /relrowsecurity/);
      assert.match(sql, /seven_app_server_access/);
      assert.match(sql, /seven_readonly_select_access/);
      assert.match(sql, /qual, ''\)\)\) = 'false'/);
      assert.deepEqual(values, [CUSTOMER_PROFILE_MEDIA_MIGRATION]);
      return { rows: row ? [row] : [] };
    },
  } as unknown as Pick<Pool, 'query'>;
}

test('customer profile media endpoints fail closed until the private RLS-protected schema is ready', async () => {
  const complete = {
    migration_applied: true,
    table_ready: true,
    app_policy_ready: true,
    readonly_policy_ready: true,
  };
  assert.equal(CUSTOMER_PROFILE_MEDIA_MIGRATION, '033_customer_profile_media.sql');
  assert.equal(await customerProfileMediaSchemaIsReady(fakeProfileMediaPool(complete)), true);
  assert.equal(await customerProfileMediaSchemaIsReady(fakeProfileMediaPool()), false);
  assert.equal(await customerProfileMediaSchemaIsReady(fakeProfileMediaPool({ ...complete, migration_applied: false })), false);
  assert.equal(await customerProfileMediaSchemaIsReady(fakeProfileMediaPool({ ...complete, table_ready: false })), false);
  assert.equal(await customerProfileMediaSchemaIsReady(fakeProfileMediaPool({ ...complete, app_policy_ready: false })), false);
  assert.equal(await customerProfileMediaSchemaIsReady(fakeProfileMediaPool({ ...complete, readonly_policy_ready: false })), false);
  assert.equal(isCustomerProfileMediaRoute('/api/me/avatar'), true);
  assert.equal(isCustomerProfileMediaRoute('/api/me/avatar/upload-intents'), true);
  assert.equal(isCustomerProfileMediaRoute('/api/me/avatar/550e8400-e29b-41d4-a716-446655440000/complete'), true);
  assert.equal(isCustomerProfileMediaRoute('/api/me/avatarish'), false);
  assert.equal(isCustomerProfileMediaRoute('/api/me'), false);
});
