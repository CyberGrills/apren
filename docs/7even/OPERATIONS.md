# Operating 7even

18 October 2026. This local runbook includes multi-provider collection and direct-wallet USDC. Start with [README.md](../../README.md) and keep the [release constraints](IMPLEMENTATION_REVIEW.md#release-constraints-not-hidden-completion-claims) visible when promoting an environment. No production deployment is established here.

## Install and configure

Use Node.js 24 or later and PostgreSQL; the local implementation was exercised on Node.js 24.21 and PostgreSQL 18. Run `npm ci --ignore-scripts` from the repository root. The root lockfile owns all four workspaces. Use only the setup and migration commands documented in this guide; review any additional script before running it.

Copy `.env.example` to `.env` and supply environment-specific values privately. Keep `APP_ORIGIN` exactly equal to the browser origin, including scheme, host and port. The local development browser uses `http://127.0.0.1:5177`; the built application normally uses `http://127.0.0.1:7077`. Never publish `.env`, `.local/`, recovery links or seed passwords.

| Configuration | Purpose |
|---|---|
| `DATABASE_URL` | Runtime database login with membership of `seven_app`, without superuser, database/role creation or bypass-RLS privileges. It must not own the schema. |
| `MIGRATION_DATABASE_URL` | Separate administrator connection used by `npm run db:migrate`. The runner falls back to `DATABASE_URL` if absent; do not rely on that fallback in a deployed environment. |
| `TEST_DATABASE_URL` | Administrator connection to a disposable database whose name ends in `_test_db`. Integration fixtures reset that database's `seven` schema. |
| `TEST_RUNTIME_DATABASE_URL` | Restricted `seven_app` login for the same disposable database, used by HTTP acceptance tests. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional server-only stay-search credentials. Both are required. Select a model supported by the API account for Structured Outputs; no default model is selected. |
| `SEVEN_PREVIEW_READ_ONLY` | Optional `true` rejects preview HTTP mutations except stay search, including its rate-limit writes. Production ignores the flag. Use isolated preview storage and workers as well. |
| `NODE_ENV`, `PORT`, `APP_ORIGIN` | Runtime mode, API listener port and canonical browser origin. The API binds all interfaces; production requires HTTPS ingress. |
| `PAYMENT_MODE` | `mock` for explicit local demonstrations; `live` for real adapters. Production rejects mock mode and requires both fiat providers. |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET` | Server-only credentials. `FLUTTERWAVE_WEBHOOK_SCHEME` must be `v3-verif-hash` for this adapter. Do not substitute another webhook protocol. |
| `PAYSTACK_SECRET_KEY` | Server-only test/live Paystack key; also verifies HMAC-SHA512 signatures on exact raw webhook payloads. |
| `CRYPTO_ENABLED` | Defaults to `false`; enables live crypto only when `true` and a Base RPC connection is configured. Local mock crypto uses an isolated gateway. |
| `CRYPTO_CHAIN_ID` | `84532` for Base Sepolia external testing; `8453` for reviewed Base mainnet production. No other network is supported. |
| `BASE_RPC_URL` | Blank in the template. Supply a private server-side HTTPS endpoint for the selected Base network. Treat any embedded provider key as a secret. |
| `SEED_PASSWORD` | Private development fixture password; seed generates a local password if absent. Seed is forbidden in production. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Optional recovery delivery configuration. Ports 465 or 587 require verified TLS; partially configured or insecure SMTP is rejected. |

Nodemailer 10.1.2 and viem 2.57.7 are installed and pinned by the root lockfile. The earlier SMTP package-download blocker is resolved. Real SMTP acceptance, sender authentication and mailbox delivery remain untested; injected transport tests do not prove those external effects.

## Database and startup

Create empty databases using a PostgreSQL administrator, then run `npm run db:migrate`. Migrations 001 through 009 create the `seven` schema, `seven_owner`, `seven_app` and `seven_readonly` groups and current tables/constraints. Migration 009 backfills historical Flutterwave routes, preserves original receipt journals, scopes provider identities and adds reviewed accounts and immutable crypto quotes/proofs. It targets small local tables; production row counts, locks and backfill scheduling require review. These groups are not login credentials. Provision a separate runtime login with inherited group privileges; for example, after migration run `CREATE ROLE seven_runtime LOGIN INHERIT PASSWORD '<set-a-secret-outside-the-shell-history>';` followed by `GRANT seven_app TO seven_runtime WITH INHERIT TRUE;`. For existing membership, repeat that `GRANT` to correct its membership option. Do not grant schema ownership, superuser, `CREATEDB`, `CREATEROLE` or `BYPASSRLS` to the runtime login. Verify with `SELECT current_user, has_schema_privilege(current_user, 'seven', 'USAGE'), pg_has_role(current_user, 'seven_app', 'USAGE');`; both checks must return `true`. `INHERIT FALSE` does not automatically supply ordinary schema access. The runner serializes migrations under an advisory lock, applies each transactionally and rejects changed checksums. Do not edit an applied migration; add a reviewed forward migration.

Run `npm run db:seed` only for a disposable development environment. The seed creates labelled synthetic businesses, accounts, inventory and sample points. It does not import external or historical customer and business records. Sample observations are excluded from demand evidence.

Hotel stays must pass the admin verification checklist before approval: operating property, partner authority/consent, contact, address, independently checked coordinates, current NGN rates, room/occupancy/policy evidence and a documented inventory freshness window. Every evidence item needs a reference. Public stay discovery, quote creation and reservation holds enforce that review and the configured freshness window. Inventory freshness is recorded separately from allocation updates; booking activity does not refresh a partner confirmation. Migration 011 deliberately marks pre-existing inventory stale, so the property owner must confirm availability again through the business availability endpoint before those windows become discoverable or bookable.

`npm run dev` starts the API on port 7077 and Vite on loopback port 5177. Vite proxies same-origin `/api`; the restored local PostgreSQL instance also uses loopback. `npm run build` performs TypeScript checking and writes the frontend build. With a built frontend and the appropriate `APP_ORIGIN`, `npm start` serves API and SPA on the configured API port. The API listener binds to `0.0.0.0`, so it is not confined to loopback; reachability depends on host/network controls. A production ingress must deliberately provide HTTPS and reviewed access controls. No deployed ingress, firewall or TLS configuration is proved by the local run.

`GET /api/health/live` checks that the process responds. `GET /api/health/ready` also queries PostgreSQL. Neither endpoint proves provider, SMTP, bank or worker health.

Migrations 012 and 013 enable row-level security for internal tables and preserve access for the established server roles according to existing grants. Tenant authorization remains in the application. Migration 014 pins six integrity trigger functions to `pg_catalog, seven`; it replaces the older branch's function script without changing the applied 010 and 011 files. Its `ALTER FUNCTION` statements are safe to repeat if an environment previously applied that old script. Test migration upgrades and effective runtime privileges before release. The privileged Supabase Data API operation in `database/operations/` is separate, requires project-specific review, and is not run by application migrations.

## Recovery and queued work

The API process starts a recovery cycle every 15 seconds, with a local overlap guard. The worker expires holds and trade proposals, repairs abandoned durable request claims, verifies uncertain payments/refunds, processes provider inbox records, produces recipient-scoped in-app notifications from the outbox and checks settlement evidence. PostgreSQL locks, unique source identities and leases protect shared effects across processes; the local timer guard alone is not the concurrency control. Later refund observations that contradict an already delivered identity, amount or status preserve the completed accounting and appear in the admin exception queue.

Provider inbox work uses batches of five, two-minute leases and a five-attempt bound with backoff. Outbox consumption uses batches of 50 and five attempts. Exhausted or failed records remain visible for operational review. Settlement reads are bounded to 25 candidate payments and three subaccounts per cycle; each claimed attempt is delayed 15 minutes and capped at 12 checks. The admin operations screen exposes failures, stale work, source state and reward moderation. Review the attributable reason and current provider evidence before using a retry control.

The checked crash fixture uses real child-process termination and PostgreSQL rollback with synthetic provider responses. It does not establish infrastructure failover or restore correctness. After any restart, compare current durable state with provider records rather than issuing a new charge or refund merely because a browser timed out.

## Reception and PWA limits

A reception source belongs to an authenticated user and business, with venue authorization enforced again on the server. The reception UI queues only check-in and service-completion actions locally. Each has a stable event ID, expected reservation revision and source scope. The queue holds at most 50 actions. Accepted or duplicate acknowledgements remove the corresponding action atomically; conflicts remain available for explicit resolution. Logout and business/account changes purge private queue scopes.

A queued action is pending, not a confirmed service update. Cancellation, new bookings, payments, benefit consumption and shared-inventory allocation require the server. Do not promise an offline sale of the last room. The service worker caches the public shell and static assets, never private `/api` responses. A cold offline restart cannot repopulate private reservations or recheck a session. The already-open reception UI can queue its supported actions, then sync once connectivity returns. Installation depends on browser support; this is a web app, not a native reception installer or vendor PMS adapter.

## Payment and settlement review

Fiat payable totals up to and including ₦50,000 use Paystack; totals strictly above ₦50,000 use Flutterwave. The comparison includes stated tax. Routing, execution mode and provider account revision are frozen before dispatch, with no automatic fallback. Verify each business's matching `ACCT_` Paystack or `RS_` Flutterwave account through admin onboarding. The approved commission is 10% of discounted service excluding separately stated taxes; actual provider fees reduce the business share. Hosted checkout keeps card collection with the chosen processor. A redirect is never payment authority.

Investigate by provider plus reservation, merchant reference, attempt ID and transaction ID. Compare exact NGN values, currency, subaccount and saved bank revision. A receipt can be `PAID` while bank settlement is `UNSETTLED` or `PENDING`. Completed bank delivery needs matching transaction, destination, actual fee, net and settlement evidence. The Paystack path currently lacks sufficient normalized bank-delivery evidence, so it stays pending for review. Never infer bank credit from charge success.

For USDC, the business owner signs a five-minute challenge bound to business, wallet, Base network and revision. An administrator reviews the pending destination before enabling it. Checkout supports native USDC on Base, using ordinary externally owned signing accounts only. Smart contract wallets are not supported. Test externally on Base Sepolia before considering mainnet. 7even holds no private keys and signs no merchant transfer.

The token quote freezes an indicative NGN valuation and exact six-decimal USDC atoms for at most five minutes. A 60-minute reservation hold allows finalized chain verification. All tokens go to the saved business wallet; 7even's 10% service commission is an NGN receivable owed by that business. It must not be reported as collected cash. Customers approve their wallet's ETH gas fee. Wrong token/network, altered amount/destination, late inclusion, uncertain or insufficient finality remain unresolved or review cases. A busy wallet or RPC timeout is not a reason to send again. Recover the original hash and reconcile it.

A crypto refund creates payment state `REFUND_PENDING` and refund state `REQUESTED`. The business sends the full original token amount from its approved original wallet to the original payer. Submit that return hash for independent finality verification. Only then append the refund and commission reversal. The platform neither signs the return nor redirects it to another wallet. Mock return completion is an explicit nonproduction control; it does not prove an on-chain return.

An extra actual charge is recorded separately, including when a reservation was already funded. A late payment does not revive expired capacity. Refunds create durable intent and compensating journal entries; uncertain external outcomes are queried before another dispatch. A completed-service refund may create a nonspendable points shortfall if points were already used. Do not repair these cases by editing balances or deleting financial history.

The Flutterwave account and approved test subaccounts are not ready. Both providers' sandbox checkout, webhook delivery, splits, refunds and actual bank credit remain external acceptance work. Base testnet wallet payment/refund delivery is also unverified. No real-money readiness claim is made.

## Account recovery and support

Development `.test` recovery messages are stored only in ignored `.local/recovery-mailbox.json` with private permissions. Real recipients are not written there. Production uses configured SMTP; without a delivery adapter recovery returns the same unavailable response for every account. Tokens expire after 15 minutes, are stored hashed, are single-use and are superseded by a new request. Password changes and successful recovery revoke prior sessions.

A delivery failure revokes the link and records a failure when the database is available. Mail delivery is asynchronous and is not a durable mail outbox; a crash before send requires a fresh recovery request. Do not log a link, paste it into an issue or attach it to a screenshot.

Login/registration use persisted per-IP and per-email counters shared by workers. Recovery has additional persisted limits. Production still needs a reviewed reverse-proxy identity policy, ingress abuse budgets, administrator second-factor policy and bank-change controls.

## Verification and safe rollback

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration` and `npm run build`. Use the isolated test database only. The test fixture administrator is deliberately more privileged than the HTTP runtime role. Preserve output and distinguish a provider double from a sandbox test. See [implementation review](IMPLEMENTATION_REVIEW.md) for the final attached evidence.

Before a real release, record a database backup and a tested restoration procedure, confirm compatibility of the candidate application with the applied schema, and obtain qualified review of money, authorization, tenancy and migration changes. The new schema does not include a legacy-data migration or automated down migrations. A rollback means restoring a known compatible application artifact or executing a reviewed forward correction; do not drop production schemas, rewrite applied checksums or delete journals. If data restoration is required, pause affected writes under an agreed incident procedure, preserve the current evidence, restore to an isolated environment first and reconcile provider/bank movements before resuming.

Production alerts, restore drills, dependency/secret/static/API scan evidence, real SMTP/provider checks and applicable Nigerian payment/privacy review remain outstanding. This runbook does not authorize deployment.
