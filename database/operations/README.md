# Supabase project-level API security operations

The 7even application accesses its operational data through the server-side PostgreSQL connection in `services/platform/src/db.ts`; its SQL queries target the internal `seven` schema. The browser app does not use Supabase's table REST/GraphQL Data API for this operational schema.

## Exclude `seven` from the Data API

Run `remove_seven_from_data_api_exposed_schemas.sql` with a Supabase database-admin connection. This is intentionally stored outside `database/migrations/`: the app migration runner executes files in that directory using a restricted migration/runtime connection, which must not manage the privileged `authenticator` role.

The SQL sets the PostgREST schema list to `public, graphql_public`, excludes `seven`, revokes Data API role access to objects in `seven`, removes default grants for future objects created by `seven_owner` or `postgres`, and notifies PostgREST to reload configuration.

**Configuration note:** using `ALTER ROLE authenticator SET pgrst.db_schemas` is Supabase's documented manual override. After it is configured, the Dashboard's exposed-schema setting no longer manages this list; future schema changes must be made through the role setting, or the manual override must first be removed and the Dashboard configuration restored.

## RLS for internal data

Migrations `012` and `013` enable RLS on all existing `seven` tables and add policies matching the established server roles' existing SQL grants:
- `seven_app`: server application operations, still limited by its table-level grants.
- `seven_readonly`: read-only server access, still limited by its SELECT grants.
- `anon`, `authenticated`, and `service_role`: no schema/table/routine privileges; no policies are created for them.

Do not grant the internal schema to browser clients. If a future client genuinely needs Data API access, expose narrowly scoped views in a dedicated API schema and design/test per-table policies for that access model.
