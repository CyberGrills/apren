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

/** Latest migration required by the Creator Studio API surface. */
export const CREATOR_REQUIRED_SCHEMA_MIGRATION = '036_creator_artwork_rights_malware_quarantine.sql';

export const CREATOR_ARTWORK_TABLES = [
  'creator_profiles',
  'creator_artworks',
  'creator_artwork_media',
  'creator_artwork_rights_evidence',
  'creator_artwork_community_permissions',
  'creator_artwork_attribution_reviews',
  'creator_artwork_rights_decisions',
  'creator_artwork_rights_documents',
  'creator_artwork_rights_document_scan_jobs',
] as const;

interface CreatorArtworkSchemaReadinessRow extends QueryResultRow {
  migration_applied: boolean;
  creator_tables_ready: boolean;
}

/**
 * Creator routes are only available when the complete, RLS-protected schema is installed.
 * A missing optional subsystem must not turn requests into unhandled PostgreSQL 42P01 errors.
 */
export async function creatorArtworkSchemaIsReady(db: Pick<Pool, 'query'>): Promise<boolean> {
  const result = await db.query<CreatorArtworkSchemaReadinessRow>(
    `SELECT
       EXISTS (
         SELECT 1 FROM seven.migrations WHERE migration_name = $1
       ) AS migration_applied,
       (
         SELECT count(*) = cardinality($2::text[])
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'seven'
           AND c.relkind = 'r'
           AND c.relname = ANY($2::text[])
           AND c.relrowsecurity
           AND EXISTS (
             SELECT 1 FROM pg_policies p
             WHERE p.schemaname = 'seven'
               AND p.tablename = c.relname
               AND p.policyname = 'seven_app_server_access'
               AND p.cmd = 'ALL'
               AND p.roles = ARRAY['seven_app']::name[]
           )
       ) AS creator_tables_ready`,
    [CREATOR_REQUIRED_SCHEMA_MIGRATION, [...CREATOR_ARTWORK_TABLES]],
  );
  const row = result.rows[0];
  return row?.migration_applied === true && row?.creator_tables_ready === true;
}

const CREATOR_ARTWORK_ROUTE_PREFIXES = [
  '/api/creator',
  '/api/art-culture',
  '/api/admin/creator-submissions',
  '/api/admin/creator-rights',
] as const;

export function isCreatorArtworkRoute(pathname: string): boolean {
  return CREATOR_ARTWORK_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
