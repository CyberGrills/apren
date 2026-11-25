# 7EVEN migration reconciliation audit

**Audit date:** 22 November 2026  
**Scope:** Read-only inspection of the application migration runner, repository migration files, live `seven` schema, application migration ledger, Supabase migration history, booking-table RLS policies and database roles.

## Executive result

Do not apply the hotel inventory schema migration yet. The booking model and application authorization paths are present, but migration provenance and the production runtime database identity still need a controlled reconciliation.

No production schema, data, role, policy, credential, deployment or application setting was changed during this audit.

## 1. Which migration system owns the 7EVEN application schema?

The application runner is `backend/platform/src/migrate.ts`, invoked by `npm run db:migrate`.

It:

- Reads SQL files from `database/migrations`.
- Selects names matching `/^\d+.*\.sql$/` and sorts the full filenames lexicographically.
- Computes a SHA-256 checksum for each file.
- Uses a transaction-scoped advisory lock before checking or applying each migration.
- Looks up the exact `migration_name` in `seven.migrations`.
- Refuses to continue if an already-recorded filename has a different checksum.
- Applies an unrecorded file and records its name and checksum in `seven.migrations`.
- Has explicit legacy-adoption handling for the two demo wallet migration aliases (027 and 028); it does not automatically reconcile arbitrary entries in Supabase's migration ledger.

This makes `seven.migrations` the application runner's ledger. The Supabase CLI ledger is a separate history and must not be treated as a one-to-one mirror.

## 2. Live migration-history findings

Read-only counts on the production project:

| Source | Records |
|---|---:|
| Repository `database/migrations` SQL files | 37 |
| Application ledger `seven.migrations` | 37 |
| Supabase `supabase_migrations.schema_migrations` | 42 |

The application ledger has a filename discrepancy:

- Live ledger: `010_function_search_path.sql`
- Current repository: `010_hotel_search_indexes.sql`
- The old `010_function_search_path.sql` source file is not present at that path on current `main`.
- `011_inventory_confirmation_freshness.sql` and `014_function_search_path.sql` are present and recorded.
- Both `033_creator_artwork_foundation.sql` and `033_customer_profile_media.sql` are present and recorded.

The two 033 migrations are distinct full filenames, so the current runner can distinguish them. However, duplicate numeric prefixes make history harder to reason about and should not be repeated.

The runner does not currently perform a preflight check that every applied `seven.migrations` row still has a corresponding source file. It can therefore miss a removed historical source file while processing newer migrations.

The Supabase history contains 42 records, including public-schema history and legacy names. Its naming and chronology differ from the application ledger. The runner's explicit 027/028 compatibility aliases are the only automatic bridge found in the inspected code. Do not try to force the two ledgers to have identical row counts.

### Hotel search-index migration

The current `010_hotel_search_indexes.sql` file is not recorded in the live application ledger. The expected objects from that file were also absent in the live database at audit time:

- `offerings_public_sector_created_idx`
- `offerings_public_city_created_idx`
- `offerings_public_city_trgm_idx`
- `businesses_workflow_business_idx`
- `inventory_windows_available_offer_dates_idx`
- `pg_trgm` extension

A separate freshness-oriented inventory index from migration 011 is present. The absence of the 010 file's objects means the hotel search-index migration has not been applied to this database.

Do not simply renumber or replay this file yet. First check every environment's application ledger and migration history. If no environment has applied this exact file, move it into a forward-only sequence with the next available migration number. If another environment has recorded it, preserve that history and add a new idempotent forward migration instead. Do not edit an applied migration.

## 3. RLS and tenant authorization

RLS is enabled on the inspected core tables: `businesses`, `venues`, `memberships`, `offerings`, `inventory_windows`, `quotes`, `reservations` and `allocations`.

The live policies for `seven_app` allow all operations with `USING (true)` and `WITH CHECK (true)`; the `seven_readonly` policies allow SELECT with `USING (true)`. These policies establish role-level access, not row-level tenant isolation.

The repository's operations guide explicitly states that tenant authorization remains in the application. The inspected application code contains the corresponding checks:

- `requireTenant` requires a matching `businessId` and a business-owner or reception role; owner-only operations additionally require the owner role.
- `requireVenue` restricts reception users to their assigned `venueIds`.
- Reservation reads call `reservationAccess`, which checks the customer identity or business and venue scope.
- Business/reception reservation actions re-check the tenant and venue.
- The normal mutation wrapper executes work inside a PostgreSQL transaction and uses idempotency claims.

This is an application-enforced tenant boundary. It must remain covered by negative cross-tenant and cross-venue integration tests. Do not weaken these checks or describe the current RLS policies as independently isolating tenants.

## 4. Runtime database role remains unverified

The inspected role catalog shows:

- `seven_app`, `seven_owner` and `seven_readonly` are non-login roles.
- Those roles are not superusers and do not have `BYPASSRLS`.
- `seven_preview_app` is a login role and is granted `seven_preview_reader`; it is not shown as a member of `seven_app`.
- No dedicated `seven_runtime` login role was found.
- The SQL inspection connection itself ran as `postgres`; this is not evidence of which identity the deployed API uses.

The operations guide describes a separate runtime login inheriting `seven_app`. The production Vercel runtime's actual database identity was not established from the database inspection. Before release, verify the effective `current_user`, `session_user`, schema privileges and `pg_has_role(..., 'seven_app', 'USAGE')` from the deployed API's database connection without exposing connection strings or secrets. Do not assume the SQL inspection connection is the API runtime.

## 5. Booking-engine integrity observations

The current booking implementation already has the core primitives that the hotel extension should reuse:

- Quote creation stores an immutable price/terms snapshot and does not allocate inventory.
- Reservation creation serializes a quote claim, locks the quoted inventory windows in deterministic UUID order, checks current capacity and creates the reservation and allocations in one transaction.
- Reservation expiry and cancellation release allocations.
- Stay listings are blocked unless the business has a valid verification review and the inventory confirmation is within its configured freshness window.
- Provider payment confirmation remains a separate workflow; a browser redirect is not payment authority.

The existing model is still generic offering/capacity inventory. The relational hotel room-category, rate-plan and nightly-rate model described in the hotel inventory design is not yet present in the live schema.

## 6. Required gates before hotel schema implementation

1. **Recover migration provenance.** Locate the exact historical source for applied `010_function_search_path.sql` from a trusted archived branch, release artifact or migration backup. Do not reconstruct it from its checksum or from a similarly named migration.
2. **Inventory every environment.** Compare the application ledger and Supabase migration history for production, preview and any staging database. Establish whether `010_hotel_search_indexes.sql` has been applied anywhere.
3. **Resolve numbering.** Preserve applied migration names and checksums. Give future migrations unique, monotonically increasing sequence numbers. Add a CI preflight that rejects duplicate new sequence numbers and detects applied ledger rows with missing source files.
4. **Verify runtime identity.** Establish the production API's effective database role and least-privilege membership before changing schema or relying on the intended `seven_app` grants.
5. **Prove authorization.** Run negative tests for owner A reading/writing business B, reception A accessing venue B, customer A reading customer B's reservation, and unauthorized owner-only rate changes.
6. **Only then add hotel tables.** Implement room types, rate plans and nightly rates as a reviewed forward migration, reusing the existing allocation, quote, reservation and payment lifecycle. Do not add a second booking engine.

## Audit boundary

This report is documentation only. It does not apply migrations, alter grants or RLS policies, create hotel inventory, seed live data, connect a PMS, change Vercel settings, merge code or deploy production.

## Follow-up correction — runtime role naming (23 November 2026)

The initial role summary above used the name `seven_runtime` and described `seven_owner` as non-login. That was an inspection/reporting error; the live role name includes the digit **7**.

A fresh read-only role-catalog inspection shows:

- `7even_runtime` is a login role, inherits `seven_app`, and is neither a superuser nor granted `BYPASSRLS`.
- `seven_owner` is also a login role, but is neither a superuser nor granted `BYPASSRLS`.
- `seven_app` and `seven_readonly` are non-login roles.
- `seven_preview_app` is a login role inheriting `seven_preview_reader`; it is not a member of `seven_app`.

The production `/api/health/ready` endpoint returned HTTP 200 at 2026-11-23 03:36:17 UTC. A recent idle Supavisor session for `7even_runtime` was observed immediately after that request, with its state changing at 03:36:16.972 UTC. This is consistent with the intended production runtime role and confirms that the role is actively used; the endpoint does not expose a per-request `current_user`, so exact request-to-session correlation is not claimed.

No database role, password, grant, membership, policy, or production configuration was changed. The original statement that no `seven_runtime` role exists is literally true but was misleading because the actual runtime login is named `7even_runtime`.
