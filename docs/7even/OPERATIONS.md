# Operating 7even

16 October 2026. This is a local runbook for the rebuilt application, not evidence of a production deployment. Start with [README.md](../../README.md) and keep the [release constraints](IMPLEMENTATION_REVIEW.md#release-constraints-not-hidden-completion-claims) visible when promoting an environment.

## Install and configure

Use Node.js 24 or later and PostgreSQL; the local implementation was exercised on Node.js 24.21 and PostgreSQL 18. Run `npm ci --ignore-scripts` from the repository root. The root lockfile owns all four workspaces. Historical installers in `legacy/` are not setup commands.

Copy `.env.example` to `.env` and supply environment-specific values privately. Keep `APP_ORIGIN` exactly equal to the browser origin, including scheme, host and port. The local development browser uses `http://127.0.0.1:5177`; the built application normally uses `http://127.0.0.1:7077`. Never publish `.env`, `.local/`, recovery links or seed passwords.

| Configuration | Purpose |
|---|---|
| `DATABASE_URL` | Runtime database login with membership of `seven_app`, without superuser, database/role creation or bypass-RLS privileges. It must not own the schema. |
| `MIGRATION_DATABASE_URL` | Separate administrator connection used by `npm run db:migrate`. The runner falls back to `DATABASE_URL` if absent; do not rely on that fallback in a deployed environment. |
| `TEST_DATABASE_URL` | Administrator connection to a disposable database whose name ends in `_test_db`. Integration fixtures reset that database's `seven` schema. |
| `TEST_RUNTIME_DATABASE_URL` | Restricted `seven_app` login for the same disposable database, used by HTTP acceptance tests. |
| `NODE_ENV`, `PORT`, `APP_ORIGIN` | Runtime mode, loopback API listener port and canonical browser origin. Production requires HTTPS. |
| `PAYMENT_MODE` | `mock` for explicit local demonstrations; `flutterwave` for the configured v3 adapter. Production rejects mock mode. |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET` | Server-only credentials. `FLUTTERWAVE_WEBHOOK_SCHEME` must be `v3-verif-hash` for this adapter. Do not substitute another webhook protocol. |
| `SEED_PASSWORD` | Private development fixture password; seed generates a local password if absent. Seed is forbidden in production. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Optional recovery delivery configuration. Ports 465 or 587 require verified TLS; partially configured or insecure SMTP is rejected. |

The optional SMTP path uses Nodemailer 10.1.2. Its dependency and integrity are locked, but the new tarball could not be downloaded during this local session because registry access timed out. Install it successfully before enabling SMTP. The injected transport tests do not prove package installation, DNS sender authentication, provider acceptance or real mailbox delivery.

## Database and startup

Create empty databases using a PostgreSQL administrator, then run `npm run db:migrate`. Migrations 001 through 008 create the `seven` schema, `seven_owner`, `seven_app` and `seven_readonly` group roles, constraints, grants and subsequent changes. These groups are not login credentials. Provision a separate runtime login and grant only the application group. The migration runner serializes with an advisory lock, applies each file transactionally and rejects a changed checksum for an applied migration. Do not edit an applied migration; add a reviewed forward migration.

Run `npm run db:seed` only for a disposable development environment. The seed creates labelled synthetic businesses, accounts, inventory and sample points. It does not migrate Apren customers or business records. Sample observations are excluded from demand evidence.

`npm run dev` starts the platform API on loopback port 7077 and Vite on 5177. Vite proxies same-origin `/api`. `npm run build` performs TypeScript checking and writes the frontend build. With a built frontend and the appropriate `APP_ORIGIN`, `npm start` serves API and SPA on the configured API port. The current listener binds to `127.0.0.1`; a deployed HTTPS ingress must be deliberately configured. No container, ingress or cloud deployment is included in the local proof.

`GET /api/health/live` checks that the process responds. `GET /api/health/ready` also queries PostgreSQL. Neither endpoint proves provider, SMTP, bank or worker health.

## Recovery and queued work

The API process starts a recovery cycle every 15 seconds, with a local overlap guard. The worker expires holds and trade proposals, repairs abandoned durable request claims, verifies uncertain payments/refunds, processes provider inbox records, produces recipient-scoped in-app notifications from the outbox and checks settlement evidence. PostgreSQL locks, unique source identities and leases protect shared effects across processes; the local timer guard alone is not the concurrency control.

Provider inbox work uses batches of five, two-minute leases and a five-attempt bound with backoff. Outbox consumption uses batches of 50 and five attempts. Exhausted or failed records remain visible for operational review. Settlement reads are bounded to 25 candidate payments and three subaccounts per cycle; each claimed attempt is delayed 15 minutes and capped at 12 checks. The admin operations screen exposes failures, stale work, source state and reward moderation. Review the attributable reason and current provider evidence before using a retry control.

The checked crash fixture uses real child-process termination and PostgreSQL rollback with synthetic provider responses. It does not establish infrastructure failover or restore correctness. After any restart, compare current durable state with provider records rather than issuing a new charge or refund merely because a browser timed out.

## Reception and PWA limits

A reception source belongs to an authenticated user and business, with venue authorization enforced again on the server. The reception UI queues only check-in and service-completion actions locally. Each has a stable event ID, expected reservation revision and source scope. The queue holds at most 50 actions. Accepted or duplicate acknowledgements remove the corresponding action atomically; conflicts remain available for explicit resolution. Logout and business/account changes purge private queue scopes.

A queued action is pending, not a confirmed service update. Cancellation, new bookings, payments, benefit consumption and shared-inventory allocation require the server. Do not promise an offline sale of the last room. The service worker caches the public shell and static assets, never private `/api` responses. A cold offline restart cannot repopulate private reservations or recheck a session. The already-open reception UI can queue its supported actions, then sync once connectivity returns. Installation depends on browser support; this is a web app, not a native reception installer or vendor PMS adapter.

## Payment and settlement review

The business bank mapping is obtained through the provider and frozen on each payment attempt before dispatch. The approved rule is 10% of discounted service value, excluding separately stated taxes; actual processing fees reduce the business share. Hosted checkout keeps card collection with Flutterwave. A browser redirect is never payment authority.

Investigate by reservation reference, merchant reference, payment attempt ID and provider transaction ID. Compare exact NGN minor-unit amounts, currency, configured subaccount and bank revision. A verified receipt can be `PAID` while settlement remains `UNSETTLED` or `PENDING`. Marking bank settlement requires matching per-transaction provider evidence, destination, actual fee, net amount and completed settlement details. Missing or inconsistent evidence is retained for review rather than inferred from a successful charge.

An extra actual charge is recorded separately, including when a reservation was already funded. A late payment does not revive expired capacity. Refunds create durable intent and compensating journal entries; uncertain external outcomes are queried before another dispatch. A completed-service refund may create a nonspendable points shortfall if points were already used. Do not repair these cases by editing balances or deleting financial history.

The Flutterwave account and test subaccounts are not ready. Sandbox checkout, webhook delivery, splits, refund behavior and actual bank credit remain external acceptance work. No real-money readiness claim is made.

## Account recovery and support

Development `.test` recovery messages are stored only in ignored `.local/recovery-mailbox.json` with private permissions. Real recipients are not written there. Production uses configured SMTP; without a delivery adapter recovery returns the same unavailable response for every account. Tokens expire after 15 minutes, are stored hashed, are single-use and are superseded by a new request. Password changes and successful recovery revoke prior sessions.

A delivery failure revokes the link and records a failure when the database is available. Mail delivery is asynchronous and is not a durable mail outbox; a crash before send requires a fresh recovery request. Do not log a link, paste it into an issue or attach it to a screenshot.

Login/registration use persisted per-IP and per-email counters shared by workers. Recovery has additional persisted limits. Production still needs a reviewed reverse-proxy identity policy, ingress abuse budgets, administrator second-factor policy and bank-change controls.

## Verification and safe rollback

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration` and `npm run build`. Use the isolated test database only. The test fixture administrator is deliberately more privileged than the HTTP runtime role. Preserve output and distinguish a provider double from a sandbox test. See [implementation review](IMPLEMENTATION_REVIEW.md) for the final attached evidence.

Before a real release, record a database backup and a tested restoration procedure, confirm compatibility of the candidate application with the applied schema, and obtain qualified review of money, authorization, tenancy and migration changes. The new schema does not include a legacy-data migration or automated down migrations. A rollback means restoring a known compatible application artifact or executing a reviewed forward correction; do not drop production schemas, rewrite applied checksums or delete journals. If data restoration is required, pause affected writes under an agreed incident procedure, preserve the current evidence, restore to an isolated environment first and reconcile provider/bank movements before resuming.

Production alerts, restore drills, dependency/secret/static/API scan evidence, real SMTP/provider checks and applicable Nigerian payment/privacy review remain outstanding. This runbook does not authorize deployment.
