import type { Pool, QueryResultRow } from 'pg';

/** Latest migration required by the current API contract. Keep covered by the migration-order test. */
export const REQUIRED_SCHEMA_MIGRATION = '026_quote_recovery_session_attribution.sql';

interface SchemaReadinessRow extends QueryResultRow {
  migration_applied: boolean;
  booking_recovery_events_present: boolean;
  quote_recovery_session_column_present: boolean;
}

/**
 * Readiness must reflect the schema used by the revenue-recovery path, not just
 * the existence of an old migration ledger row. This query is read-only.
 */
export async function schemaIsReady(db: Pick<Pool, 'query'>): Promise<boolean> {
  const result = await db.query<SchemaReadinessRow>(
    'SELECT EXISTS (SELECT 1 FROM seven.migrations WHERE migration_name = $1) AS migration_applied, ' +
      "to_regclass('seven.booking_recovery_events') IS NOT NULL AS booking_recovery_events_present, " +
      "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='seven' AND table_name='quotes' AND column_name='recovery_session_id') AS quote_recovery_session_column_present",
    [REQUIRED_SCHEMA_MIGRATION],
  );
  const row = result.rows[0];
  return row?.migration_applied === true && row?.booking_recovery_events_present === true && row?.quote_recovery_session_column_present === true;
}
