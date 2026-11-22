import type { Pool, QueryResultRow } from 'pg';

/** Latest migration required by the core recovery API contract. Demo schema is environment-specific. */
export const REQUIRED_SCHEMA_MIGRATION = '026_quote_recovery_session_attribution.sql';

interface SchemaReadinessRow extends QueryResultRow {
  migration_applied: boolean;
  booking_recovery_events_present: boolean;
  quote_recovery_session_column_present: boolean;
  recovery_policy_contract_present: boolean;
  demo_marketplace_schema_present: boolean;
}

/**
 * Readiness verifies the durable recovery telemetry contract and its scoped RLS policies.
 * The isolated demo marketplace is required only outside production, where its routes are mounted.
 */
export async function schemaIsReady(db: Pick<Pool, 'query'>, environment = 'development'): Promise<boolean> {
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
    (environment === 'production' || row?.demo_marketplace_schema_present === true)
  );
}


/** Migration that creates the private customer profile photo table and bucket. */
export const CUSTOMER_PROFILE_MEDIA_MIGRATION = '033_customer_profile_media.sql';

interface CustomerProfileMediaSchemaReadinessRow extends QueryResultRow {
  migration_applied: boolean;
  table_ready: boolean;
  app_policy_ready: boolean;
  readonly_policy_ready: boolean;
}

/**
 * Avatar endpoints are optional until the private media table and its exact
 * least-privilege policies are installed. This prevents a missing migration
 * from becoming an unhandled PostgreSQL relation error after an app deploy.
 */
export async function customerProfileMediaSchemaIsReady(
  db: Pick<Pool, 'query'>,
): Promise<boolean> {
  const result = await db.query<CustomerProfileMediaSchemaReadinessRow>(
    `SELECT
       EXISTS (
         SELECT 1 FROM seven.migrations WHERE migration_name = $1
       ) AS migration_applied,
       EXISTS (
         SELECT 1
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'seven'
           AND c.relname = 'customer_profile_media'
           AND c.relkind = 'r'
           AND c.relrowsecurity
       ) AS table_ready,
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'seven'
           AND tablename = 'customer_profile_media'
           AND policyname = 'seven_app_server_access'
           AND cmd = 'ALL'
           AND permissive = 'PERMISSIVE'
           AND roles = ARRAY['seven_app']::name[]
           AND lower(btrim(coalesce(qual, ''))) = 'true'
           AND lower(btrim(coalesce(with_check, ''))) = 'true'
       ) AS app_policy_ready,
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'seven'
           AND tablename = 'customer_profile_media'
           AND policyname = 'seven_readonly_select_access'
           AND cmd = 'SELECT'
           AND permissive = 'PERMISSIVE'
           AND roles = ARRAY['seven_readonly']::name[]
           AND lower(btrim(coalesce(qual, ''))) = 'false'
           AND with_check IS NULL
       ) AS readonly_policy_ready`,
    [CUSTOMER_PROFILE_MEDIA_MIGRATION],
  );
  const row = result.rows[0];
  return row?.migration_applied === true
    && row?.table_ready === true
    && row?.app_policy_ready === true
    && row?.readonly_policy_ready === true;
}

export function isCustomerProfileMediaRoute(pathname: string): boolean {
  return pathname === '/api/me/avatar' || pathname.startsWith('/api/me/avatar/');
}
