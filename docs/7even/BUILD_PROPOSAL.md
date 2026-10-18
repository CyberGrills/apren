# 7even build proposal

Status: approved for implementation by the user, 16 October 2026. The user approved Flutterwave, the 10% commission and fee rules, points after verified payment and completed service, and all five product surfaces. Production release requires separate evidence and qualified review.

## Product

7even connects guests with rooms, dining, and experiences in Nigeria. Customers pay through 7even checkout using Flutterwave. The provider splits settlement between the business's verified bank subaccount and 7even's 10% commission. Guests earn points on eligible completed visits and redeem them for business-funded benefits. Businesses use the same engine to run reception, manage availability, understand demand, and keep customer activity in sync. Payment success and actual bank settlement are distinct states.

The first release includes all five connected surfaces: landing website, customer app, business dashboard, reception workspace, and platform admin. The customer and reception experiences are responsive, installable web apps. A future sector implements the engine's capacity, eligibility, and fulfillment contracts without rewriting bookings, permissions, points, or audit history.

The existing Apren source is the reference for the underlying idea, not the foundation for financial or inventory correctness. Food freshness becomes hospitality service windows and availability. Asset ownership becomes a right to a booked service or issued benefit. Exchange becomes a business-permitted transfer or swap of eligible benefits. The points balance is not a customer cash wallet, an investment, or a claim of ownership in a business.

## Confirmed decisions

- First market: Nigeria, with NGN prices and Africa/Lagos as the default venue time zone.
- First hospitality scope: rooms, dining, and experiences together.
- Payment: Flutterwave checkout through 7even, with business bank subaccounts and a 10% platform commission. This supersedes the earlier direct-payment/manual-confirmation premise.
- Preserve the concepts of rewards, ownership, exchange, value, demand intelligence, and recorded decisions.
- Start with 7even's own reception workspace, and provide an integration boundary for existing hotel systems later.
- Preserve the supplied black 7even logo and wordmark. Use natural copy, with no em dash or inflated claims.
- Address every prior review finding through replacement, regression coverage, or removal from the active runtime. Do not carry the numbered engine layers into the new deployment.

## Proposed starter operating rules

These make the first build concrete. Product approval of this proposal accepts these rules; they remain versioned settings where indicated.

1. **Payment confirmation:** initialize Flutterwave hosted checkout on the server, bound to one customer, reservation, immutable NGN quote, unique transaction reference, and verified business subaccount. Authenticate provider notifications using the selected API/account version's documented protocol, then re-query Flutterwave and match reference, amount, currency, status, and expected business allocation before granting value. A redirect, receipt image, staff assertion, or browser payload cannot mark a platform transaction paid. Reception can record a separate offline cash/payment note for a walk-in, but cannot turn it into a Flutterwave-confirmed payment.
2. **Reservation holds:** the default hold is 15 minutes, configurable by business policy. The server holds capacity atomically. Payment verification converts a still-live allocation or records `PAID_REVIEW_REQUIRED` without allocating inventory. Use server processing time and current allocation state, not a claimed payment timestamp, to resolve the race. Never revive an expired allocation. Provider checkout expiry is coordinated with the hold, but late and uncertain provider outcomes remain explicit.
3. **Commission and fees:** calculate the 10% commission on the service amount after discounts, excluding separately stated taxes, using integer minor units and a documented nearest-kobo rounding rule. The proposed starting fee policy deducts Flutterwave's actual processing fee from the business's share, with no extra unannounced customer charge. Verify that policy against the configured split and actual provider settlement. Do not assume the business bank received exactly 90% or report a settlement until provider records establish it. A business must have a validated, approved subaccount before live checkout is enabled.
4. **Point earning:** points are issued only after a provider-verified eligible payment and an authorized completed service. Each issuance is tied to one source event and one policy version. There is no fixed universal naira-to-point conversion. Admin sets the earning policy and merchants opt into eligible offers. Development seed rates are visibly sample policies, not promises to real customers.
5. **Point redemption:** a common 7even points balance can be used for rewards that a participating business explicitly publishes and funds. Each reward states its points cost, capacity, service window, and terms. No cash-out, purchased points, interest, or unconfigured universal discount is promised.
6. **Reversals and refunds:** cancelled or unfulfilled reservations earn no points. A refund has its own authorized request, provider attempt, pending/uncertain/completed state, and reconciliation against provider records. Never blindly repeat an uncertain refund. An eligible refund or fraud correction creates compensating monetary and points records keyed once to the original event. Points use customer accounts plus issuance/redemption contra accounts. If reversal of spent points creates an accounting shortfall, that shortfall is nonspendable, carries no implied cash debt, freezes redemption, and is offset by later earnings or an attributable reviewed adjustment. Preserve all original entries.
7. **Ownership and exchange:** bookings and transferable benefits are distinct entitlement kinds. Booking rights cannot enter gift/swap endpoints. Businesses can publish transferable benefits separately. Only unconsumed, unexpired, transferable benefits not locked by another pending exchange can be gifted or swapped; acceptance is atomic, auditable, updates the ownership revision, and invalidates the previous owner's claim. A new owner may transfer again if the business policy permits it. No cash resale is included.
8. **Reception installation:** start with an installable web app on supported desktop browsers. The same app works on tablets. A first-party synchronization contract connects reception to the common backend. A native Windows/macOS installer and a vendor-specific PMS adapter require a named operating environment and are not claimed as already working.
9. **Offline reception:** the app shows connectivity and pending actions. It can queue limited operational edits with stable IDs, then reconcile when online. A queued action is never displayed as a confirmed booking, final availability change, or earned reward until the server accepts it. Confirming shared inventory while offline would require a separately allocated offline allotment and is outside this starter rule.
10. **Automation:** verified reception and provider events automatically update availability, operational views, points eligibility, and demand calculations. Price or offer recommendations include their evidence and constraints. Publishing a new price or commercial offer requires the business's permission and bounds; missing data produces an honest insufficient-data result.

## Surfaces and complete journeys

| Surface | Working capabilities |
|---|---|
| Public website | Brand, rooms/dining/experiences discovery, business value, how payment and rewards work, business application, login, help and policy links |
| Customer app | Account and profile, city/date/category search, real availability, listing details, server-priced quotes, reservations, Flutterwave checkout, payment/refund history, cancellation, points journal, rewards, owned benefits, eligible gift/swap, notifications |
| Business dashboard | Business and venue setup, offering creation/publication, prices/terms, room-night or sitting/seat capacity, availability calendar, reservation management, staff access, reward catalog, operational activity, demand and recommendation review |
| Reception | Arrivals/departures, walk-in reservations, check-in/check-out, dining attendance and experience fulfillment, unit/service availability, provider-confirmed payment/refund status, separate walk-in payment notes, operational timeline, install/sync state and conflict queue |
| Platform admin | Business applications and approval, tenant suspension, sector capabilities, versioned reward policy, merchant/reward moderation, operational health, points exceptions, integration/device status, audit and limited support access |

The acceptance journey is one real API-backed customer reservation appearing at reception and in the business dashboard, progressing through server-verified Flutterwave payment and fulfillment, issuing points once, then redeeming or exchanging an eligible benefit with the resulting history visible to the customer and admin. Separate tests exercise rooms, dining, and experiences, commission/settlement reconciliation, and delayed/uncertain payment outcomes. Local provider doubles prove deterministic contracts only; real Flutterwave sandbox verification requires configured test credentials and cannot be claimed without executed evidence.

## Engine and data model

Use one PostgreSQL authority and a modular Node backend. Keep React and Vite for the interfaces, add TypeScript and shared validated request/response contracts. This removes the old split SQLite/PostgreSQL truth and the fragile gateway routing. A same-origin API serves the interfaces; authentication is a server session in secure HTTP-only cookies, with CSRF/origin checks and server-side role and resource authorization.

Business is the tenant. A business can manage several venues. Membership grants a person explicit business and venue capabilities. A sector defines a capability, not a tenant or a global role. Customer data is visible only through the booking, service, and support permissions required for the task.

| Engine module | Responsibility |
|---|---|
| Identity and access | Customer/staff/admin accounts, sessions, bounded recovery, membership and venue permissions |
| Businesses and catalog | Applications, approval, venues, public projections, offering descriptions and terms |
| Capacity | Room nights, dining covers in configured sittings, experience seats in occurrences, closures and out-of-service capacity |
| Quotes and reservations | Exact NGN minor units, immutable terms snapshots, expiring holds, valid state transitions, cancellation and fulfillment |
| Payments and settlement | Flutterwave checkout, immutable transaction references/subaccount mappings, verified payments, 10% commission, fees, balanced NGN journal, merchant/platform settlement records, refunds, uncertainty and reconciliation |
| Points and rewards | Integer balanced postings, source-event uniqueness, reserved/available balances, earning, redemption, reversal and exceptions |
| Entitlements and exchange | Current owner, eligibility, expiry, merchant rules, gift/swap proposals and atomic acceptance |
| Reception and connectors | Versioned events, durable deduplication, cursors, mapping, acknowledgments, stale/conflict review and reconciliation |
| Demand | Source-labelled searches, quotes, reservations, cancellations and fulfillment; deterministic baseline, evidence and freshness |
| Audit and follow-up | Attributable immutable records, transactional outbox, bounded retry and recovery, in-app notifications |

Rooms consume one unit for every local date in the check-in-inclusive/check-out-exclusive range. Dining consumes covers in an explicit configured sitting, with its duration and buffer. Experiences consume seats in an occurrence. Inventory is checked and changed under database transactions across all relevant windows, in a consistent lock order.

Mutating requests carry an authenticated actor, a caller-scoped idempotency key bound to payload, and an expected revision where concurrent editing matters. The same transaction writes the business state, audit record, and outgoing event. The system acknowledges durable effects, deduplicates retries, and does not promise distributed exactly-once delivery.

## Core invariants

- Active holds plus confirmed allocations never exceed saleable capacity for any required service window.
- Expiry, confirmation, cancellation, and walk-in booking use the same capacity authority and cannot release capacity twice.
- Prices use exact integer kobo; points use exact integers. Quantity, duration, amount, and limits are validated on the server.
- A quote's price and terms cannot change after acceptance. A quote alone does not reserve stock.
- Every points journal balances in its own unit; customers cannot overspend available points. Issuer accounts and reversal exceptions have explicit rules.
- Every monetary journal balances per currency. Merchant receivables, platform commission, provider fees, settlement and refunds reconcile to provider records; derived balances are not the only truth.
- One eligible business event issues points once. Replaying payment, checkout, sync, or worker events does not issue a second reward.
- A benefit has one current owner. Restricted, expired, fulfilled, cancelled, or currently exchange-locked benefits cannot be transferred. Booking entitlements are not transferable benefits.
- Staff cannot read or change another tenant's data. Platform admin access is explicit and recorded.
- A pending payment or offline edit never masquerades as a completed effect.
- Demand insights name their source window and coverage. Synthetic data, simulation, and insufficient evidence remain visible.

## Technical structure and proposed commands

```text
apps/web/                 Landing and role-specific React interfaces
services/platform/        API, modules, persistence and durable follow-up work
packages/contracts/       Shared request, response and domain schemas
packages/engine/          Sector policies, lifecycle, pricing and demand logic
database/migrations/      Ordered PostgreSQL schema changes
tests/                    API, persistence, concurrency and recovery tests
e2e/                      Browser journeys and responsive/accessibility checks
docs/7even/               Product specification, decisions, operating guide and evidence
learn/                    One learning breakdown at completion
```

Proposed root commands are `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run db:migrate`, and `npm run db:seed`. These are implementation requirements, not claims that those commands exist yet. Production startup will serve the built interfaces and API through a configured HTTPS origin. Local development and tests use isolated data. Sample businesses and accounts must not be mistaken for live partners.

Contract example, proposed:

```typescript
type HoldResult =
  | { kind: 'held'; reservationId: string; expiresAt: string; revision: number }
  | { kind: 'conflict'; code: 'CAPACITY_CHANGED' | 'QUOTE_EXPIRED' };
```

Use explicit types and one error envelope. Public catalog data, customer responses, business operations and admin responses are separate projections. Never return password hashes, session credentials, connector secrets, or internal stack traces. Secrets and sender/provider configuration remain outside source.

## Delivery order and verification

1. Freeze the approved contracts, state machines, role matrix, sector behavior, data classification, and legacy-finding acceptance matrix. Review the schema and threat boundaries before implementing effects.
2. Build the authoritative engine, migrations, identities, and role/resource enforcement. Prove fresh setup, restart persistence, exact values, and tenant isolation.
3. Deliver catalog through quote, hold, reservation, Flutterwave checkout/verification, reception fulfillment, and customer history. Prove each sector, payment uncertainty, split accounting and concurrency boundaries before adding rewards.
4. Add points, rewards, ownership and exchange. Prove duplicate requests, simultaneous redemption, reversal and ownership races against the database.
5. Add reception install/offline/sync behavior, first-party connector, audit/outbox recovery, and in-app notifications. Test duplicate, stale, delayed, reordered, interrupted and revoked-source events.
6. Add evidence-based demand rules and dashboards. Prove recommendation constraints, missing-data behavior, and separation of advisory output from authorized effects.
7. Complete the visual system and all surfaces, then test keyboard, mobile/tablet/desktop, reduced motion, loading/empty/error states, real data flows, and runtime logs.
8. Run independent code/security/design review, relevant scans, a clean install/build/test cycle, and the full acceptance journey. Record residual release requirements honestly.

Focused tests accompany each increment. Concurrency tests use separate database clients/processes, not just an in-process lock. The same command is submitted ten times; many customers compete for the last unit; staff and customers race for availability; a worker stops before/after commit; the server restarts; sync events replay; cross-user and cross-business identifiers are attempted. Tests assert final capacity, ownership, ledger and audit state as well as HTTP responses.

## Design direction

Start from the supplied angular black mark. Explore three coherent directions before choosing the final system. The current lead is warm editorial hospitality: ivory, ink, one deep green signal color, generous typography and real place photography. The discovery pages can be spacious and expressive; reception and dashboards must stay legible, quick, and precise. They share tokens and recognizable controls, with density appropriate to the job.

Research includes the full installed ten-source design catalog and original hospitality projects on Dribbble and Behance. Reuse the selected principles and licensed patterns, not another designer's artwork or a pile of incompatible effects. Photography must have a usable license and must not falsely identify a sample venue. Preserve native pointer/keyboard behavior and reduced motion.

Example customer copy: "Find a stay, book a table, or try something new. Book and pay through 7even. Earn points on eligible visits."

Example reception copy: "Arrivals today", "Waiting for payment confirmation", "Saved on this device", "Waiting to sync", and "Review this change". A pending action always names what remains to happen.

Better Design's hosted MCP is not connected. Superdesign CLI preflight reports no authenticated session. Local pinned references remain available; no hosted generation, upload, paid credits or hosted review is claimed.

## Verified repository facts

| Fact | Evidence |
|---|---|
| Existing source is the reviewed Apren checkout | `git rev-parse HEAD` returned `26d61a4aaf0ee87411b57df2ac94a5e5ad607e33`; `git status --short` was empty before proposal work |
| React/Vite and Node are already in use | `apps/web/package.json`, root `package.json`; prior verified build on Node 24.21.0 and Vite 8.1.5 |
| Old read/write paths disagree | `services/assets/src/db.js` and `services/assets/src/repositories/assetRepository.js`; prior HTTP/source evidence in `../APREN_REVIEW_DATA.json` |
| The old engine cannot establish actual fulfillment | `services/assets/src/agent/agentVerifier.js` checks simulated status; `services/assets/src/verification/verify.js` fabricates verification |
| Authorization and commercial effects must be replaced | `services/assets/src/server.js`, `transactions/walletTransfer.js`, `economy/fundingEngine.js`; independent review and isolated probes recorded in the review data |
| A PostgreSQL test runtime is available locally | Read-only inspection located PostgreSQL 18.6 server tools; no server was provisioned during proposal research |
| Existing generated history is not a migration system | All 125 scripts were reviewed without execution; generated output and interface/schema drift are catalogued in `../APREN_FILE_GUIDE.txt` |

Primary technical sources: [PostgreSQL locks](https://www.postgresql.org/docs/current/explicit-locking.html), [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [installable web apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), and [offline/background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation). Browser background work is bounded by browser behavior; durable server recovery and foreground sync remain necessary.

Flutterwave primary references: [Standard hosted checkout](https://developer.flutterwave.com/reference/checkout), [split payments](https://developer.flutterwave.com/docs/split-payments), [transaction verification](https://developer.flutterwave.com/docs/transaction-verification), [v3 webhook protocol](https://developer.flutterwave.com/docs/webhooks), [v4 webhook protocol](https://developer.flutterwave.com/v4.0/docs/webhooks), and [settlements](https://developer.flutterwave.com/docs/settlements). The selected provider/API version must be explicit. Current v3 docs describe `verif-hash`; v4 docs describe raw-body HMAC-SHA256 in `flutterwave-signature`. Do not accept a weaker fallback automatically or combine incompatible version semantics. Record and sandbox-test the chosen contract. Hosted checkout avoids storing card details in 7even; it does not by itself establish PCI or regulatory compliance.

## Boundaries and completion

The authorized work includes a replacement local application, schema, tests, documentation, and local development/test services. Preserve existing Git history and review artifacts. Do not overwrite an unrelated hotel database or migrate real guest records without a separate reviewed plan.

No production deployment, paid service purchase, live customer charge, real business onboarding, external message, production credential creation, or claim of compatibility with an unnamed PMS is authorized by this proposal. A complete local acceptance build is distinct from a production release. The release needs configured hosting/HTTPS, real business/payment policies, backup/recovery evidence, relevant security scans, and qualified review of authentication, tenant boundaries, points and exchange.

No requirement is considered satisfied by a static mockup, a simulated success response, a generated confidence number, or an unexecuted test. The completion report must identify working flows, fresh evidence, and any external release requirements still missing.
