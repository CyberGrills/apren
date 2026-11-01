import type { Pool, QueryResultRow } from 'pg';

/** Latest migration required by the current API contract. Covered by the migration-order test. */
export const REQUIRED_SCHEMA_MIGRATION = '028_demo_wallet_ledger_type.sql';

interface SchemaReadinessRow extends QueryResultRow {
  migration_applied: boolean;
  booking_recovery_events_present: boolean;
  quote_recovery_session_column_present: boolean;
  recovery_policy_contract_present: boolean;
  demo_marketplace_schema_present: boolean;
}

/**
 * Readiness must reflect the schema used by the revenue-recovery path, not just
 * the existence of an old migration-ledger row. This query is read-only.
 */
export async function schemaIsReady(db: Pick<Pool, 'query'>): Promise<boolean> {
  const result = await db.query<SchemaReadinessRow>(
    `SELECT
       EXISTS (
         SELECT 1 FROM seven.migrations WHERE migration_name = $1
       ) AS migration_applied,
       to_regclass('seven.booking_recovery_events') IS NOT NULL AS booking_recovery_events_present,
       (to_regclass('seven.demo_catalog_items') IS NOT NULL
         AND to_regclass('seven.demo_wallets') IS NOT NULL
         AND to_regclass('seven.demo_bookings') IS NOT NULL
         AND to_regclass('seven.demo_wallet_entries') IS NOT NULL) AS demo_marketplace_schema_present,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'seven' AND table_name = 'quotes' AND column_name = 'recovery_session_id'
       ) AS quote_recovery_session_column_present,
       (
         EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'seven' AND tablename = 'booking_recovery_events'
             AND policyname = 'seven_app_server_access'
             AND cmd = 'ALL'
             AND permissive = 'PERMISSIVE'
             AND roles = ARRAY['seven_app']::name[]
             AND lower(btrim(coalesce(qual, ''))) = 'true'
             AND lower(btrim(coalesce(with_check, ''))) = 'true'
         )
         AND EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'seven' AND tablename = 'booking_recovery_events'
             AND policyname = 'seven_readonly_select_access'
             AND cmd = 'SELECT'
             AND permissive = 'PERMISSIVE'
             AND roles = ARRAY['seven_readonly']::name[]
             AND lower(btrim(coalesce(qual, ''))) = 'true'
             AND with_check IS NULL
         )
       ) AS recovery_policy_contract_present`,
    [REQUIRED_SCHEMA_MIGRATION],
  );
  const row = result.rows[0];
  return (
    row?.migration_applied === true &&
    row?.booking_recovery_events_present === true &&
    row?.quote_recovery_session_column_present === true &&
    row?.recovery_policy_contract_present === true &&
    row?.demo_marketplace_schema_present === true
  );
}
