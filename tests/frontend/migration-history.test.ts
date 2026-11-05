import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from '../../backend/platform/src/db.ts';
import {
  isLegacyMigrationSchemaCompatible,
  type LegacyMigrationSchemaState,
  legacySupabaseMigrationAlias,
  legacySupabaseMigrationAlreadyApplied,
} from '../../backend/platform/src/migrate.ts';

const completeDemoSchema: LegacyMigrationSchemaState = {
  demoCatalogItemsPresent: true,
  demoWalletsPresent: true,
  demoBookingsPresent: true,
  demoWalletEntriesPresent: true,
  demoCatalogColumnsPresent: true,
  demoWalletColumnsPresent: true,
  demoBookingColumnsPresent: true,
  demoWalletEntryColumnsPresent: true,
  demoTablesRlsEnabled: true,
  demoAppPoliciesPresent: true,
  demoCatalogReadonlyPolicyPresent: true,
  demoEntryTypeLength: 20,
};

test('maps only the two known Supabase-applied migrations to repository migration files', () => {
  assert.equal(
    legacySupabaseMigrationAlias('027_demo_marketplace_wallet.sql'),
    'demo_marketplace_wallet_027',
  );
  assert.equal(
    legacySupabaseMigrationAlias('028_demo_wallet_ledger_type.sql'),
    'demo_wallet_ledger_type_028',
  );
  assert.equal(
    legacySupabaseMigrationAlias('029_booking_recovery_shadow_decisions.sql'),
    undefined,
  );
  assert.equal(legacySupabaseMigrationAlias('027_other_migration.sql'), undefined);
});

test('adopts the legacy demo marketplace migration only when all tables, columns and RLS policies match', () => {
  assert.equal(
    isLegacyMigrationSchemaCompatible('027_demo_marketplace_wallet.sql', completeDemoSchema),
    true,
  );
  assert.equal(
    isLegacyMigrationSchemaCompatible('027_demo_marketplace_wallet.sql', {
      ...completeDemoSchema,
      demoWalletEntryColumnsPresent: false,
    }),
    false,
  );
  assert.equal(
    isLegacyMigrationSchemaCompatible('027_demo_marketplace_wallet.sql', {
      ...completeDemoSchema,
      demoTablesRlsEnabled: false,
    }),
    false,
  );
  assert.equal(
    isLegacyMigrationSchemaCompatible('027_demo_marketplace_wallet.sql', {
      ...completeDemoSchema,
      demoCatalogReadonlyPolicyPresent: false,
    }),
    false,
  );
});

test('adopts the legacy ledger widening only when entry_type is varchar(20)', () => {
  assert.equal(
    isLegacyMigrationSchemaCompatible('028_demo_wallet_ledger_type.sql', completeDemoSchema),
    true,
  );
  assert.equal(
    isLegacyMigrationSchemaCompatible('028_demo_wallet_ledger_type.sql', {
      ...completeDemoSchema,
      demoEntryTypeLength: 12,
    }),
    false,
  );
  assert.equal(
    isLegacyMigrationSchemaCompatible('028_demo_wallet_ledger_type.sql', {
      ...completeDemoSchema,
      demoWalletEntriesPresent: false,
    }),
    false,
  );
  assert.equal(
    isLegacyMigrationSchemaCompatible(
      '029_booking_recovery_shadow_decisions.sql',
      completeDemoSchema,
    ),
    false,
  );
});

function legacyHistoryConnection(
  options: { historyTable?: boolean; applied?: boolean; state?: LegacyMigrationSchemaState } = {},
): Connection {
  const historyTable = options.historyTable ?? true;
  const applied = options.applied ?? true;
  const state = options.state ?? completeDemoSchema;
  return {
    query: async (sql: string, values?: unknown[]) => {
      if (sql.includes("to_regclass('supabase_migrations.schema_migrations')")) {
        return {
          rows: [{ table_name: historyTable ? 'supabase_migrations.schema_migrations' : null }],
        };
      }
      if (sql.includes('FROM supabase_migrations.schema_migrations')) {
        assert.deepEqual(values, ['demo_marketplace_wallet_027']);
        return { rows: applied ? [{ name: 'demo_marketplace_wallet_027' }] : [] };
      }
      if (sql.includes('demoCatalogItemsPresent')) return { rows: [state] };
      throw new Error('Unexpected migration history query.');
    },
  } as unknown as Connection;
}

test('adopts a legacy migration only when Supabase history and the verified schema both agree', async () => {
  assert.equal(
    await legacySupabaseMigrationAlreadyApplied(
      legacyHistoryConnection(),
      '027_demo_marketplace_wallet.sql',
    ),
    true,
  );
  assert.equal(
    await legacySupabaseMigrationAlreadyApplied(
      legacyHistoryConnection({ historyTable: false }),
      '027_demo_marketplace_wallet.sql',
    ),
    false,
  );
  assert.equal(
    await legacySupabaseMigrationAlreadyApplied(
      legacyHistoryConnection({ applied: false }),
      '027_demo_marketplace_wallet.sql',
    ),
    false,
  );
  assert.equal(
    await legacySupabaseMigrationAlreadyApplied(
      legacyHistoryConnection(),
      '029_booking_recovery_shadow_decisions.sql',
    ),
    false,
  );
  await assert.rejects(
    legacySupabaseMigrationAlreadyApplied(
      legacyHistoryConnection({ state: { ...completeDemoSchema, demoTablesRlsEnabled: false } }),
      '027_demo_marketplace_wallet.sql',
    ),
    /schema does not match/,
  );
});

test('adopts the legacy ledger migration only with a verified varchar(20) column', async () => {
  const connection: Connection = {
    query: async (sql: string, values?: unknown[]) => {
      if (sql.includes("to_regclass('supabase_migrations.schema_migrations')")) {
        return { rows: [{ table_name: 'supabase_migrations.schema_migrations' }] };
      }
      if (sql.includes('FROM supabase_migrations.schema_migrations')) {
        assert.deepEqual(values, ['demo_wallet_ledger_type_028']);
        return { rows: [{ name: 'demo_wallet_ledger_type_028' }] };
      }
      if (sql.includes('demoCatalogItemsPresent')) {
        return { rows: [{ ...completeDemoSchema, demoEntryTypeLength: 20 }] };
      }
      throw new Error('Unexpected migration history query.');
    },
  } as unknown as Connection;
  assert.equal(
    await legacySupabaseMigrationAlreadyApplied(connection, '028_demo_wallet_ledger_type.sql'),
    true,
  );
});
