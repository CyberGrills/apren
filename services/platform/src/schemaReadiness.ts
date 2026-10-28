import type { Pool, QueryResultRow } from 'pg';

/** Latest migration required by the current API contract. Keep covered by the migration-order test. */
export const REQUIRED_SCHEMA_MIGRATION = '025_booking_recovery_rls_policy_contract.sql';

interface SchemaReadinessRow extends QueryResultRow {
  migration_applied: boolean;
  booking_recovery_events_present: boolean;
}

/**
 * Readiness must reflect the schema used by the revenue-recovery path, not just
 * the existence of an old migration ledger row. This query is read-only.
 */
export async function schemaIsReady(db: Pick<Pool, 'query'>): Promise<boolean> {
  const result = await db.query<SchemaReadinessRow>(
    'SELECT EXISTS (SELECT 1 FROM seven.migrations WHERE migration_name = $1) AS migration_applied, ' +
      "to_regclass('seven.booking_recovery_events') IS NOT NULL AS booking_recovery_events_present",
    [REQUIRED_SCHEMA_MIGRATION],
  );
  const row = result.rows[0];
  return row?.migration_applied === true && row?.booking_recovery_events_present === true;
}
