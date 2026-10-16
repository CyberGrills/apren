# āprən Hospitality Migration Audit and Implementation Plan

**Target experience:** 7even  
**Platform and intelligence layer:** āprən  
**Scope:** Convert the existing platform into a hospitality operating and guest-experience system without discarding reusable infrastructure.

## Audit basis and confidence

This audit was prepared from the repository's GitHub `main` branch at the time of inspection. It is a **source-code audit**, not a live runtime or database verification. The local WSL checkout may contain newer or unpushed work; compare local HEAD, working-tree changes, and origin/main before applying changes. Do not overwrite local changes or assume GitHub main is identical to the user's running checkout.

## 1. Current repository baseline

The repository is a Node.js npm-workspaces monorepo with a Vite/React frontend and Express services.

| Component | Current role seen in source | Hospitality target |
|---|---|---|
| `apps/web` | Vite + React application; `AprenApp.jsx` contains food assets, kitchens, food-market pulse and wallet UI | 7even guest experience plus separate staff/manager workflows |
| `services/gateway` | Express/Axios proxy on port 4000; routes assets, passport, ownership, asset-profile, users, wallet, brain, market and trade | Versioned hospitality API; route requests to identity, inventory, reservations, payments and intelligence |
| `services/identity` | PostgreSQL-backed user lookups and currency preferences in the inspected source | Guests, staff, hosts, property/venue managers, role-based access and sessions |
| `services/wallet` | Reads wallet rows by user ID | Payment provider references, booking deposits, refunds, ledger and reconciliation; no raw card data stored |
| `services/assets` | Large food-asset, lifecycle, evidence, market/economy and intelligence engine | Reuse general asset/evidence patterns only where useful; introduce explicit hospitality resources rather than relabeling food assets |
| `services/market` | Hard-coded example supply/demand and sample prices | Real availability and rate rules; seasonal demand signals and offers from verified records |
| `services/intelligence` | Simple score combining freshness, demand, fixed trust and liquidity scores; evidence storage | Guest-intent-aware recommendations, service triage, demand forecasting and decision support with explanations |
| `services/trade` | In-memory sample trades; `POST /trade/execute` returns an executed response without a durable transaction in the inspected file | Reservation/order state machine and payment orchestration; never report a booking/payment as complete without persisted confirmation |
| `services/shared/db.js` | Shared database connection module | Explicit migrations and data ownership for hospitality domain tables |

Ports listed in the repository README: web 5173; gateway 4000; identity 4001; wallet 4002; assets 4003; market 4004; intelligence 4005; trade 4006.

## 2. Preserve, adapt, replace

### Preserve, subject to tests
- npm workspaces and current service boundaries.
- Existing gateway pattern, with stricter routing, timeouts, request validation and consistent error envelopes.
- Existing identity and PostgreSQL connection infrastructure, after verifying the current local checkout's auth implementation.
- Wallet/ledger concepts where they support real bookings and refunds.
- Intelligence primitives for rules, feedback, orchestration and audit trails, provided each retained module has a defined hospitality use case and tests.

### Adapt
- Identity: add explicit role and organization/property scope; authorize every private read/write server-side.
- Assets: create typed hospitality entities (property, room/unit, venue, table, service, menu item/resource) instead of overloading food-asset records.
- Market: replace fixtures with property-specific rates, availability, restrictions and dated offers.
- Intelligence: replace freshness/food-economy scoring with guest preference, availability, service quality, price fit, operational risk and demand signals. Keep the rule: **respect guest intent first; optimize second**.
- Wallet: connect payment intents and provider webhooks to a double-entry or otherwise auditable ledger. Treat wallet balance as a ledger-derived value, not an arbitrary mutable number.

### Replace or retire from customer-facing flows
- Food-asset trading, food-token/Schwa assumptions where they do not serve hospitality, farm/kitchen asset marketplace screens, freshness-led asset investment, and hard-coded market/trade fixtures.
- Do not delete old modules wholesale during the first migration. Mark obsolete entry points, isolate them, and remove them only after usage and dependency checks.

## 3. Target domain model

Implement explicit, relational domain entities with stable IDs, timestamps, currency codes and audit fields:

- `organizations`: hospitality operator or group.
- `properties`: hotel, restaurant, venue or serviced accommodation; timezone, address and localization settings.
- `property_memberships`: user role and scope at organization/property level.
- `resources`: room/unit, table, venue space or bookable service; type, capacity, status and property ID.
- `rate_plans`: currency, price basis, cancellation rules, included services and date validity.
- `availability_blocks`: resource, start/end, status and source; prevent overlapping confirmed bookings for exclusive resources.
- `guests` / `guest_preferences`: explicit consent and purpose limits for preference storage.
- `reservations`: guest, property, resource, start/end, party size, status, quote snapshot, currency, cancellation policy and idempotency key.
- `reservation_events`: append-only audit trail for state transitions.
- `payments`: provider, provider reference, amount, currency, status and reservation reference; no card PAN/CVV.
- `ledger_accounts` / `ledger_entries`: immutable balanced entries for captures, refunds, fees and payouts.
- `service_requests`: housekeeping, maintenance, concierge, room service or other tasks with priority, assignment, SLA and event history.
- `reviews_feedback`: authenticated stay/service context, moderation status and structured feedback.
- `intelligence_decisions`: input references, recommendation, rationale, confidence, policy version and outcome.

Use PostgreSQL migrations with foreign keys, unique constraints, check constraints and indexes. Store event timestamps in UTC and preserve the property's IANA timezone for local display and business rules. Use ISO currency codes and integer minor units for money; do not use floating-point arithmetic for financial amounts.

## 4. Booking and payment invariants

1. Availability is checked on the server at quote and confirmation time.
2. Two concurrent requests must not confirm the same exclusive resource for overlapping times.
3. A booking has a defined state machine, for example: `draft → held → pending_payment → confirmed`, with explicit `expired`, `cancelled`, `checked_in`, `completed` and `no_show` transitions as appropriate.
4. A payment is confirmed only from a verified provider response/webhook, with signature validation and idempotent processing.
5. Booking confirmation and financial ledger writes are transactional where they share the database; external payment actions use idempotency keys and reconciliation for partial failures.
6. Refunds are separate ledger events, not destructive edits to old transactions.
7. Every manager/staff action is authorized against the relevant property and written to an audit trail.
8. Never claim a reservation, charge, refund or payout succeeded until durable state confirms it.

## 5. Delivery phases and acceptance gates

### Phase 0 — Reconcile and baseline (first)
- Capture local `git status`, HEAD, branch and recent commits.
- Compare local HEAD to `origin/main`; identify unpushed commits and uncommitted changes.
- Run the existing startup health checks and frontend build.
- Inventory routes, tables, migrations, environment variable names (never print secret values), and all UI/API food-economy references.
- Confirm current authentication routes and test them on the local checkout before changing identity/gateway code.

**Gate:** no unexplained local changes are overwritten; a baseline report lists what builds, what starts, and which endpoints pass.

### Phase 1 — Hospitality foundation
- Add a migration set for organizations, properties, memberships, resources, rate plans and availability.
- Add validation schemas and role/property authorization middleware.
- Add a hospitality domain module/service rather than placing booking rules inside the legacy assets service.
- Add tests for timezones, overlap conflicts, capacity, currency and authorization.

**Gate:** migrations are repeatable in a clean test database; unauthorized cross-property access is denied; conflicting reservations cannot both confirm.

### Phase 2 — Reservation lifecycle
- Implement search/availability, quote, hold, confirm, cancel, expiry and reservation history.
- Add idempotency for reservation creation and transitions.
- Add reservation event history and race-condition tests.

**Gate:** integration tests prove no double booking under concurrent requests and that each allowed/forbidden state transition behaves correctly.

### Phase 3 — Payment and ledger
- Select a supported payment provider based on launch markets; keep provider adapters behind an interface.
- Implement payment intents, signed webhooks, refunds, reconciliation and immutable ledger entries.
- Use test/sandbox credentials only until production checks are complete.

**Gate:** duplicate webhooks do not duplicate charges/ledger entries; failed payment cannot produce a confirmed paid booking; refund totals reconcile.

### Phase 4 — 7even experiences
- Guest: discovery, property/service detail, date/party selection, price breakdown, booking status, cancellation and service requests.
- Staff: arrivals/departures, room/table/service status, housekeeping and maintenance queue.
- Manager: inventory, rate plans, occupancy, revenue and operational exceptions.
- Replace mock food-market UI with real API-driven hospitality pages; do not present sample data as live data.

**Gate:** all primary UI flows use the gateway and real persisted records; empty, loading, error and permission states are covered.

### Phase 5 — āprən hospitality intelligence
- Start with explainable recommendations and workflow prioritization based on consented preferences and real operational data.
- Provide staff approval for consequential actions; autonomous actions must be bounded by explicit policies.
- Record recommendation rationale, source data references, confidence and outcomes; provide correction/feedback mechanisms.

**Gate:** decisions are traceable, recommendations respect explicit constraints, and the system cannot autonomously charge, cancel or materially change a booking without policy authorization.

### Phase 6 — Production readiness
- Add rate limiting, secure headers, request validation, secrets management, backups/restore tests, observability, alerting, data retention and deletion flows.
- Add localization, property timezone handling and currency formatting.
- Review privacy, consumer protection, payment-provider and accommodation regulations for each launch market.

**Gate:** restore drill passes; secrets are not in the repo/logs; critical user journeys pass CI; operational alerts and incident procedures are documented.

## 6. Immediate commands

Run these from the user's **existing local checkout** before switching branches or applying migrations:

```bash
cd /mnt/c/Windows/System32/apren || exit 1
set -eu
printf '\n=== WORKTREE ===\n'
git status --short --branch
printf '\n=== LOCAL HEAD ===\n'
git log -1 --oneline --decorate
printf '\n=== RECENT COMMITS ===\n'
git log -5 --oneline --decorate
printf '\n=== REMOTES ===\n'
git remote -v
printf '\n=== ROOT WORKSPACE SCRIPTS ===\n'
node -e 'const p=require("./package.json"); console.log(JSON.stringify({workspaces:p.workspaces,scripts:p.scripts},null,2))'
printf '\n=== HOSPITALITY AND LEGACY DOMAIN REFERENCES ===\n'
grep -RInE --exclude-dir=node_modules --exclude-dir=.git --exclude='*.backup.*' --exclude='package-lock.json' 'reservation|booking|concierge|housekeeping|property|guest|food asset|food-asset|foodBrain|food-economy|trade/execute' apps services 2>/dev/null | head -n 240 || true
printf '\n=== AUTH AND API ENTRY POINTS ===\n'
grep -RInE --exclude-dir=node_modules --exclude-dir=.git --exclude='*.backup.*' 'auth/register|auth/login|auth/me|app\.(get|post|put|patch|delete)\(' services/gateway services/identity services/wallet services/trade 2>/dev/null | head -n 240 || true
printf '\n=== DATABASE AND MIGRATION FILES ===\n'
find services -type f \( -name '*.sql' -o -iname '*migration*' -o -name 'db.js' -o -name 'postgres.js' \) -not -path '*/node_modules/*' -print | sort
printf '\n=== FRONTEND BUILD ===\n'
npm run build:web
```

This is a read-only source inspection except for the normal build output created by the existing build command. It deliberately does not print `.env` contents or modify database schemas.

## 7. Important boundary

The inspected GitHub `main` code is not proof that the local WSL checkout has the same implementation. In particular, the inspected gateway and identity server files show only basic user routes, while the local working session may contain newer authentication work. Phase 0 must reconcile that difference before implementation.

The first implementation PR should contain only the verified Phase 0 baseline and the smallest hospitality foundation migration. Do not begin by renaming every file or rewriting the large legacy intelligence engine.
