import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import type { Connection } from './db.ts';
import { createPool, one, transaction } from './db.ts';

export interface LegacyMigrationSchemaState {
  demoCatalogItemsPresent: boolean;
  demoWalletsPresent: boolean;
  demoBookingsPresent: boolean;
  demoWalletEntriesPresent: boolean;
  demoCatalogColumnsPresent: boolean;
  demoWalletColumnsPresent: boolean;
  demoBookingColumnsPresent: boolean;
  demoWalletEntryColumnsPresent: boolean;
  demoTablesRlsEnabled: boolean;
  demoAppPoliciesPresent: boolean;
  demoCatalogReadonlyPolicyPresent: boolean;
  demoEntryTypeLength: number | null;
}

const legacySupabaseMigrations: Record<string, string> = {
  '027_demo_marketplace_wallet.sql': 'demo_marketplace_wallet_027',
  '028_demo_wallet_ledger_type.sql': 'demo_wallet_ledger_type_028',
};

export function legacySupabaseMigrationAlias(filename: string): string | undefined {
  return legacySupabaseMigrations[filename];
}

export function isLegacyMigrationSchemaCompatible(
  filename: string,
  state: LegacyMigrationSchemaState,
): boolean {
  if (filename === '027_demo_marketplace_wallet.sql') {
    return (
      state.demoCatalogItemsPresent &&
      state.demoWalletsPresent &&
      state.demoBookingsPresent &&
      state.demoWalletEntriesPresent &&
      state.demoCatalogColumnsPresent &&
      state.demoWalletColumnsPresent &&
      state.demoBookingColumnsPresent &&
      state.demoWalletEntryColumnsPresent &&
      state.demoTablesRlsEnabled &&
      state.demoAppPoliciesPresent &&
      state.demoCatalogReadonlyPolicyPresent
    );
  }
  if (filename === '028_demo_wallet_ledger_type.sql') {
    return state.demoWalletEntriesPresent && state.demoEntryTypeLength === 20;
  }
  return false;
}

export async function legacySupabaseMigrationAlreadyApplied(
  client: Connection,
  filename: string,
): Promise<boolean> {
  const legacyName = legacySupabaseMigrationAlias(filename);
  if (!legacyName) return false;

  const history = await one(
    client,
    "SELECT to_regclass('supabase_migrations.schema_migrations') AS table_name",
  );
  if (!history?.table_name) return false;

  const applied = await one(
    client,
    'SELECT name FROM supabase_migrations.schema_migrations WHERE name=$1 LIMIT 1',
    [legacyName],
  );
  if (!applied) return false;

  const state = await one<LegacyMigrationSchemaState>(
    client,
    `SELECT
      to_regclass('seven.demo_catalog_items') IS NOT NULL AS "demoCatalogItemsPresent",
      to_regclass('seven.demo_wallets') IS NOT NULL AS "demoWalletsPresent",
      to_regclass('seven.demo_bookings') IS NOT NULL AS "demoBookingsPresent",
      to_regclass('seven.demo_wallet_entries') IS NOT NULL AS "demoWalletEntriesPresent",
      (SELECT count(*) = 9 FROM information_schema.columns WHERE table_schema='seven' AND table_name='demo_catalog_items' AND column_name = ANY(ARRAY['item_id','kind','title','city','state','unit_price_minor','unit_label','item_type','is_active']::text[])) AS "demoCatalogColumnsPresent",
      (SELECT count(*) = 5 FROM information_schema.columns WHERE table_schema='seven' AND table_name='demo_wallets' AND column_name = ANY(ARRAY['user_id','currency_code','balance_minor','created_at','updated_at']::text[])) AS "demoWalletColumnsPresent",
      (SELECT count(*) = 17 FROM information_schema.columns WHERE table_schema='seven' AND table_name='demo_bookings' AND column_name = ANY(ARRAY['booking_id','user_id','item_id','kind','item_title','city','start_date','end_date','quantity','unit_price_minor','total_minor','status','reference','idempotency_key','payload_hash','created_at','cancelled_at']::text[])) AS "demoBookingColumnsPresent",
      (SELECT count(*) = 10 FROM information_schema.columns WHERE table_schema='seven' AND table_name='demo_wallet_entries' AND column_name = ANY(ARRAY['entry_id','user_id','booking_id','entry_type','amount_minor','balance_after_minor','reference','idempotency_key','description','created_at']::text[])) AS "demoWalletEntryColumnsPresent",
      (SELECT count(*) = 4 FROM pg_class WHERE oid IN (to_regclass('seven.demo_catalog_items'),to_regclass('seven.demo_wallets'),to_regclass('seven.demo_bookings'),to_regclass('seven.demo_wallet_entries')) AND relrowsecurity) AS "demoTablesRlsEnabled",
      (SELECT count(DISTINCT tablename) = 4 FROM pg_policies WHERE schemaname='seven' AND tablename = ANY(ARRAY['demo_catalog_items','demo_wallets','demo_bookings','demo_wallet_entries']::text[]) AND policyname='seven_app_server_access' AND cmd='ALL' AND roles=ARRAY['seven_app']::name[]) AS "demoAppPoliciesPresent",
      EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='seven' AND tablename='demo_catalog_items' AND policyname='seven_readonly_select_access' AND cmd='SELECT' AND roles=ARRAY['seven_readonly']::name[]) AS "demoCatalogReadonlyPolicyPresent",
      (SELECT character_maximum_length FROM information_schema.columns WHERE table_schema='seven' AND table_name='demo_wallet_entries' AND column_name='entry_type') AS "demoEntryTypeLength"`,
  );

  if (!state || !isLegacyMigrationSchemaCompatible(filename, state)) {
    throw new Error(
      `Supabase records legacy migration ${legacyName}, but the existing schema does not match ${filename}. Refusing to replay or adopt it; reconcile this database manually.`,
    );
  }
  return true;
}

export async function migrate(pool: Pool): Promise<void> {
  const directory = new URL('../../../database/migrations/', import.meta.url);
  for (const filename of (await readdir(directory))
    .filter((value) => /^\d+.*\.sql$/.test(value))
    .sort()) {
    const sql = await readFile(new URL(filename, directory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    await transaction(pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('seven:migrations'))");
      const exists = await one(client, "SELECT to_regclass('seven.migrations') AS table_name");
      const previous = exists?.table_name
        ? await one(client, 'SELECT checksum FROM seven.migrations WHERE migration_name=$1', [
            filename,
          ])
        : undefined;
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error(`Migration checksum changed: ${filename}`);
        return;
      }

      if (exists?.table_name && (await legacySupabaseMigrationAlreadyApplied(client, filename))) {
        await client.query('INSERT INTO seven.migrations(migration_name,checksum) VALUES($1,$2)', [
          filename,
          checksum,
        ]);
        return;
      }

      await client.query(sql);
      await client.query(`CREATE TABLE IF NOT EXISTS seven.migrations (
        migration_id bigint GENERATED ALWAYS AS IDENTITY,
        migration_name varchar(180) NOT NULL, checksum varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT migrations_pk PRIMARY KEY(migration_id), CONSTRAINT migrations_name_uk UNIQUE(migration_name));
        ALTER TABLE seven.migrations OWNER TO seven_owner;
        GRANT SELECT ON seven.migrations TO seven_app, seven_readonly;
        COMMENT ON TABLE seven.migrations IS 'Applied immutable migration names and SHA-256 checksums.';`);
      await client.query('INSERT INTO seven.migrations(migration_name,checksum) VALUES($1,$2)', [
        filename,
        checksum,
      ]);
    });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(fileURLToPath(pathToFileURL(process.argv[1]))).href
) {
  const pool = createPool(process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL);
  try {
    await migrate(pool);
    console.log('7even migrations applied.');
  } finally {
    await pool.end();
  }
}
