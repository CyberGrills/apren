import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import type { Pool } from 'pg';
import { CREATOR_ARTWORK_TABLES, CREATOR_REQUIRED_SCHEMA_MIGRATION, creatorArtworkSchemaIsReady, isCreatorArtworkRoute, REQUIRED_SCHEMA_MIGRATION, schemaIsReady } from '../../backend/platform/src/schemaReadiness.ts';

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
});

test('both API entry points use schema-aware readiness rather than an old ledger row', async () => {
  const api = await readFile(new URL('../../backend/api/[...path].ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../backend/platform/src/app.ts', import.meta.url), 'utf8');
  assert.match(api, /schemaIsReady\(pool,\s*environment\)/);
  assert.match(app, /schemaIsReady\(pool,\s*environment\)/);
  assert.doesNotMatch(api, /SELECT 1 FROM seven\.migrations LIMIT 1/);
  assert.doesNotMatch(app, /SELECT 1 FROM seven\.migrations LIMIT 1/);
});


function fakeCreatorPool(row: {
  migration_applied: boolean;
  creator_tables_ready: boolean;
}): Pick<Pool, 'query'> {
  return {
    query: async (sql: string, values?: unknown[]) => {
      assert.match(sql, /pg_class/);
      assert.match(sql, /relrowsecurity/);
      assert.match(sql, /seven_app_server_access/);
      assert.match(sql, /cardinality\(\$2::text\[\]\)/);
      assert.deepEqual(values, [CREATOR_REQUIRED_SCHEMA_MIGRATION, [...CREATOR_ARTWORK_TABLES]]);
      return { rows: [row] };
    },
  } as unknown as Pick<Pool, 'query'>;
}

test('Creator Studio routes fail closed until every RLS-protected table in migration 036 exists', async () => {
  assert.equal(
    CREATOR_REQUIRED_SCHEMA_MIGRATION,
    '036_creator_artwork_rights_malware_quarantine.sql',
  );
  assert.equal(
    await creatorArtworkSchemaIsReady(fakeCreatorPool({
      migration_applied: true,
      creator_tables_ready: true,
    })),
    true,
  );
  assert.equal(
    await creatorArtworkSchemaIsReady(fakeCreatorPool({
      migration_applied: false,
      creator_tables_ready: true,
    })),
    false,
  );
  assert.equal(
    await creatorArtworkSchemaIsReady(fakeCreatorPool({
      migration_applied: true,
      creator_tables_ready: false,
    })),
    false,
  );
});

test('Creator Studio API route detection is narrow and includes public and moderation routes', () => {
  assert.equal(isCreatorArtworkRoute('/api/creator/profile'), true);
  assert.equal(isCreatorArtworkRoute('/api/art-culture/artworks'), true);
  assert.equal(isCreatorArtworkRoute('/api/admin/creator-submissions/123/review'), true);
  assert.equal(isCreatorArtworkRoute('/api/admin/creator-rights/evidence/123/review'), true);
  assert.equal(isCreatorArtworkRoute('/api/offerings'), false);
  assert.equal(isCreatorArtworkRoute('/api/admin/businesses/123/status'), false);
});

test('creator schema gate is installed before creator route mounts and reported by both health handlers', async () => {
  const api = await readFile(new URL('../../backend/api/[...path].ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../backend/platform/src/app.ts', import.meta.url), 'utf8');
  assert.match(app, /isCreatorArtworkRoute\(req\.path\)/);
  assert.match(app, /CREATOR_SCHEMA_NOT_READY/);
  assert.ok(app.indexOf('isCreatorArtworkRoute(req.path)') < app.indexOf('mountCreatorArtworks(app'));
  assert.match(app, /features: \{ creatorStudio: creatorStudioReady \?/);
  assert.match(api, /creatorArtworkSchemaIsReady\(pool\)/);
  assert.match(api, /features: \{ creatorStudio: creatorStudioReady \?/);
});
