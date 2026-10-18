# Active file guide

Refreshed 18 October 2026 for multi-provider payments, based on `2394f1a`. The original rebuild inventory remains pinned to `26d61a4aaf0ee87411b57df2ac94a5e5ad607e33`. Paths are relative to the repository. The active runtime consists of `apps/web`, `services/platform`, `packages/contracts` and `packages/engine`; `legacy/` is historical and is not an npm workspace.

This table began as a 152-file snapshot of active source, configuration, tests, design assets and documentation at the rebuild baseline. The 16 October seasonal-theme additions below extend that snapshot; later verification artifacts can be added independently, so the original count is not a claim of a complete current-tree inventory. `node_modules`, build output, `.env`, `.local`, database files and caches are excluded because they are generated/private runtime state. Their exclusion is not permission to commit them. Runtime dependencies are recorded by package manifests and the root lock, rather than individually documenting downloaded third-party files.

| File | Purpose |
|---|---|
| `.env.example` | Nonsecret configuration template for the API origin, PostgreSQL, provider mode, test credentials and seed inputs. Never put live values in this file. |
| `.gitignore` | Keeps dependencies, builds, local databases, environment files and private local development state out of version control. |
| `README.md` | Project entry point for local startup, configuration, verification, the approved payment rules and explicit external release limits. |
| `apps/web/index.html` | Browser document, metadata, favicon/manifest references and the React entry mount. |
| `apps/web/package.json` | Frontend package scripts and exact React, router, icons, typeface and Vite dependencies. |
| `apps/web/public/brand/7even-logo.jpeg` | Unchanged user-supplied black 7even logo image; shared Brand crops the source through SVG without redrawing it. |
| `apps/web/public/brand/icon-180.png` | 180-pixel raster export of the supplied logo treatment for the Apple touch-icon reference; not a redrawn brand. |
| `apps/web/public/brand/icon-192.png` | 192-pixel PNG manifest icon rendered from the existing supplied-logo SVG treatment. |
| `apps/web/public/brand/icon-512.png` | 512-pixel PNG manifest icon rendered from the existing supplied-logo SVG treatment. |
| `apps/web/public/brand/icon.svg` | Compact app/favicon treatment using the supplied 7even identity. |
| `apps/web/public/manifest.webmanifest` | PWA display, name, start URL, theme and icon metadata for the installable browser workspace. |
| `apps/web/public/media/SOURCES.txt` | Photography attribution, links and licensing/provenance notes for selected editorial images. |
| `apps/web/public/sw.js` | Caches public shell/static assets and supplies navigation fallback; deliberately excludes /api and private response caching. |
| `apps/web/src/App.tsx` | Defines public/account/business/reception/admin routes, session protection, role gates, scroll reset and top-level render error handling. |
| `apps/web/src/components/Brand.tsx` | Reusable logo/wordmark presentation from the actual supplied image. |
| `apps/web/src/components/Feedback.tsx` | Shared queued native popup feedback for action success/errors, dismissal/retry, navigation survival and explicit focus restoration. |
| `apps/web/src/components/WorkspaceShell.tsx` | Shared authenticated business/reception/admin navigation, mobile workspace behavior and session controls. |
| `apps/web/src/components/ui.tsx` | Semantic headers, status labels, fields, cards and exact amount presentation; bridges errors to popup feedback and supplies guarded action dialogs. |
| `apps/web/src/context/SessionContext.tsx` | Fetches the cookie-backed session, manages CSRF state and login/logout, and purges queues when identity or business changes. |
| `apps/web/src/context/SeasonContext.tsx` | One global campaign state, browser-clock timer/resume adapter and effect cleanup; synchronizes seasonal content with the document CSS selector. |
| `apps/web/src/hooks/useApi.ts` | API-backed read hook with explicit errors, aborts, visibility-aware periodic refresh and bounded retry delay. |
| `apps/web/src/lib/api.ts` | Relative /api transport with same-origin credentials, CSRF/idempotency headers, typed envelopes and explicit errors. |
| `apps/web/src/lib/editorialImages.ts` | Canonical four existing editorial stock image URLs, shared by campaigns and backward-compatible public-page imports. |
| `apps/web/src/lib/receptionQueue.ts` | Actor/business/source-scoped IndexedDB queue with atomic read/write updates, queue bounds and durable conflict results. |
| `apps/web/src/lib/season.ts` | Pure Lagos campaign calendar, next campaign's midnight boundary calculation and one bounded cancellable watcher with an injectable clock. |
| `apps/web/src/lib/seasonalCampaigns.ts` | Pure Spring/Summer/Autumn/Winter campaign copy and image metadata with descriptive alt text, illustrative-stock captions and photographer credits. |
| `apps/web/src/main.tsx` | Sets the initial season selector, mounts React inside SeasonProvider, imports fonts/styles and registers the production service worker. |
| `apps/web/src/pages/account/HelpPage.tsx` | Public help and booking/points rules with factual guidance on checkout, reception, rewards, exchange and support boundaries. |
| `apps/web/src/pages/account/RecoveryPages.tsx` | Public password-link request/reset and authenticated password-change pages, including URL token removal and no-referrer handling. |
| `apps/web/src/pages/customer/AccountPage.tsx` | Account navigation and API-backed overview shared by booking, points, benefit, exchange, updates and profile tabs. |
| `apps/web/src/pages/customer/ActivityView.tsx` | Recipient-scoped in-app notifications and server-backed mark-read action. |
| `apps/web/src/pages/customer/BenefitsView.tsx` | Current owned benefits, eligibility, current revision and private redemption details. |
| `apps/web/src/pages/customer/BookingList.tsx` | Persisted reservation cards, states, cancellation and checkout continuation. |
| `apps/web/src/pages/customer/ExchangeView.tsx` | Gift/swap proposal and acceptance/decline/cancel controls for eligible benefit entitlements. |
| `apps/web/src/pages/customer/PaymentPages.tsx` | Clearly labelled local mock checkout plus the real provider return page, which requests server verification. |
| `apps/web/src/pages/customer/PointsView.tsx` | Available points, earning/reversal entries, shortfall explanation and merchant-published reward redemption. |
| `apps/web/src/pages/customer/ProfileView.tsx` | Current account profile editing and identity/session controls. |
| `apps/web/src/pages/customer/checkout.test.ts` | Proves local mock routing and rejection of malformed or untrusted checkout destinations. |
| `apps/web/src/pages/customer/checkout.ts` | Keeps crypto local and validates the recorded provider against the exact approved Flutterwave or Paystack HTTPS checkout origin. |
| `apps/web/src/pages/customer/index.ts` | Exports the customer route and payment components. |
| `apps/web/src/pages/public/AuthPage.tsx` | Sign-in and customer registration forms, validation and safe return navigation. |
| `apps/web/src/pages/public/BookingPanel.tsx` | Date/window/quantity selection and the server quote, hold and checkout flow. |
| `apps/web/src/pages/public/BusinessApplicationPage.tsx` | Authenticated business application form and submitted-state guidance. |
| `apps/web/src/pages/public/ExplorePage.tsx` | API-backed city/category/date discovery and listing results with loading, retry and no-results states. |
| `apps/web/src/pages/public/LandingPage.tsx` | Journal-style hospitality landing page with automatically selected seasonal support copy, credited hero photograph and campaign label; preserves headline/search. |
| `apps/web/src/pages/public/OfferingPage.tsx` | Offering details, imagery, terms, amenities and the booking entry point. |
| `apps/web/src/pages/public/PublicShell.tsx` | Shared public navigation/footer and Lagos date helpers; re-exports canonical editorial images for existing public callers. |
| `apps/web/src/pages/public/index.ts` | Explicit exports of public route components for App. |
| `apps/web/src/pages/workspace/AdminPage.tsx` | Platform overview, business approval/suspension, subaccount mapping, payment review, policy versions and audit. |
| `apps/web/src/pages/workspace/BusinessPage.tsx` | Business overview and reservations, offering terms/availability, demand, rewards, team and settings workflows. |
| `apps/web/src/pages/workspace/OperationsPage.tsx` | Admin operational queue counts, reception source status and merchant reward moderation. |
| `apps/web/src/pages/workspace/PaymentNotesDialog.tsx` | Reads or records staff external-payment notes, explicitly separate from provider-confirmed payment and points eligibility. |
| `apps/web/src/pages/workspace/ReceptionPage.tsx` | Reception arrivals, walk-ins, operational actions, queued sync/conflict review, payment notes and authorized benefit consumption. |
| `apps/web/src/pages/workspace/VenuesPage.tsx` | Business venue creation, revision-aware updates and archive controls. |
| `apps/web/src/pages/workspace/shared.tsx` | Shared workspace reservation table/action dialogs, metrics and current-state presentation. |
| `apps/web/src/styles/customer.css` | Customer account, booking, benefits, exchange, points and payment layouts. |
| `apps/web/src/styles/global.css` | Exact client brand tokens, isolated seasonal accents, semantic status/surface colors, typography, controls, focus/error states, responsive primitives and reduced-motion rules. |
| `apps/web/src/styles/public.css` | Editorial landing, discovery, authentication and listing layouts, plus restrained seasonal campaign-label presentation across viewport widths. |
| `apps/web/src/styles/workspace.css` | Dense operational workspace, tables, calendars, sidebar, forms and mobile workspace styles. |
| `apps/web/src/vite-env.d.ts` | Vite client environment type declarations. |
| `apps/web/vite.config.ts` | React compilation, relative /api development proxy, build target and source maps. |
| `biome.json` | Lint/format configuration for active TypeScript, React and tests. |
| `database/migrations/001_initial.sql` | New seven schema, owner/app/read roles, lookup states, identities/tenants, inventory, quotes, reservations, journals, entitlements, inbox/outbox and deferred balance constraints. |
| `database/migrations/002_scope_and_funding.sql` | Adds venue-scoped membership, authoritative funding payment link and database triggers preventing historical journal mutation. |
| `database/migrations/003_durable_inbox.sql` | Adds expiring provider-event leases and unique provider refund identity for crash-safe competing workers. |
| `database/migrations/004_reconciliation_and_claims.sql` | Permits durable replay-result completion and adds bounded/backed-off settlement checks. |
| `database/migrations/005_account_recovery.sql` | Persists single-use recovery links and durable privacy-preserving request-limit counters. |
| `database/migrations/006_venues_and_operations.sql` | Adds revisioned/active venues, separate reception payment-note methods/records and operational metadata. |
| `database/migrations/007_integrity_metadata.sql` | Normalizes constraint labels, documents financial/integration fields and removes runtime deletion rights from retained operational records. |
| `database/migrations/008_sample_observation_provenance.sql` | Marks existing observations from explicitly seeded sample businesses synthetic without deleting their local activity. |
| `design/explorations/SOURCES.txt` | Reference URLs, image provenance and local design-source choices behind the concepts. |
| `design/explorations/after-hours.html` | Alternative dark hospitality design exploration, not the shipped direction. |
| `design/explorations/assets/7even-logo-original.jpeg` | Preserved original logo asset for the static explorations. |
| `design/explorations/desk.html` | Alternative operational desk design exploration. |
| `design/explorations/explorations.css` | Shared concept-board styles and exploration variants. |
| `design/explorations/index.html` | Static concept board linking three distinct brand/design directions. |
| `design/explorations/journal.html` | Selected warm editorial Journal design exploration. |
| `design/explorations/verification/BUILD_REVIEW.md` | Built-app browser, PWA manifest/icon and invalid reset-link checks, with installability and external delivery limitations. |
| `design/explorations/verification/POPUP_REVIEW.md` | Actual popup, action-dialog and mobile drawer browser checks, focus fixes, screenshots and specific untested interactions. |
| `design/explorations/verification/REVIEW.md` | Design agent’s actual browser journey, viewport/contrast checks, screenshots and explicit limitations. |
| `design/explorations/verification/customer-gift-consumed-mobile.jpg` | Mobile persisted consumed-benefit state after the local gift/consumption journey; private code omitted. |
| `design/explorations/verification/customer-mock-confirmed-desktop.jpg` | Browser evidence of a local mock-confirmed customer reservation, not provider sandbox payment. |
| `design/explorations/verification/customer-updates-mobile.jpg` | Mobile customer notification/read-state evidence. |
| `design/explorations/verification/landing-desktop.jpg` | Rendered desktop Journal landing-page browser evidence. |
| `design/explorations/verification/landing-mobile.jpg` | Rendered mobile Journal landing-page browser evidence. |
| `design/explorations/verification/popup-error-desktop.jpg` | Desktop centered failed-sign-in error dialog with a dimmed/inert background. |
| `design/explorations/verification/popup-error-mobile.jpg` | Mobile failed-sign-in error dialog and viewport fit evidence. |
| `design/explorations/verification/popup-invalid-reset-built.jpg` | Actual built-app invalid reset-link popup, including the visible request-link action and fallback focus behavior. |
| `design/explorations/verification/popup-profile-success-mobile.jpg` | Mobile confirmed profile-save popup; closing it was checked to restore focus to the name input. |
| `design/explorations/verification/popup-repeat-read-error-desktop.jpg` | Controlled failed session-read proof: each explicit retry produced the same error in a fresh popup while preserving the protected route. |
| `design/explorations/verification/popup-reward-confirmation-desktop.jpg` | Keyboard-opened reward confirmation dialog; Escape dismissed it without spending points. |
| `design/explorations/verification/popup-signin-success-desktop.jpg` | Sign-in success popup that survives navigation to the customer bookings view. |
| `design/explorations/verification/workspace-drawer-mobile.jpg` | Mobile business navigation drawer; focus wrapping, Escape/internal-close and opener restoration were checked. |
| `design/explorations/verification/seasonal/spring-desktop.jpg` | Actual Spring campaign desktop render with courtyard photograph, credit and stable brand palette. |
| `design/explorations/verification/seasonal/summer-desktop.jpg` | Actual Summer campaign desktop render with Lagos coast photograph, credit and stable brand palette. |
| `design/explorations/verification/seasonal/autumn-desktop.jpg` | Actual Autumn campaign desktop render with restaurant photograph, credit and stable brand palette. |
| `design/explorations/verification/seasonal/winter-desktop.jpg` | Actual Winter campaign desktop render with hotel-room photograph, credit and stable brand palette. |
| `design/explorations/verification/seasonal/QA_REPORT.md` | Seasonal real-browser viewport, brand, photography and live rollover/resume checks; records assessed inspector findings and specific untested limits. |
| `design/explorations/verification/seasonal/rollover.json` | Browser evidence for an open-page calendar transition and resume without navigation; uses the tested page's clock. |
| `docs/7even/API_CONTRACT.md` | Shared route/envelope/access contract, states, concurrency semantics and provider/mock boundaries. |
| `docs/7even/ARCHITECTURE.md` | System flow, authority boundaries, money/tenant invariants, measured demand and the code/contract extension path for sectors and PMS adapters. |
| `docs/7even/BUILD_PROPOSAL.md` | User-approved product scope, operating rules, fee/points model, architecture and release constraints. |
| `docs/7even/FILE_GUIDE.md` | This per-file guide to the active rebuild, generated artifacts and historical source mapping. |
| `docs/7even/IMPLEMENTATION_REVIEW.md` | Assesses current scope, verification limits, proposal journeys and disposition of all 42 original findings. |
| `docs/7even/OPERATIONS.md` | Actual startup/configuration, database roles, recovery limits, provider review, offline constraints, SMTP caveat and nondestructive rollback guidance. |
| `docs/7even/SEASONAL_THEMES.md` | Exact brand/proposed campaign colors, Lagos schedule, automatic watcher/cleanup design, device-clock limits, stock credits, verification scope and authoritative API references. |
| `docs/7even/evidence/dependency-audit-before-smtp.json` | Earlier zero-advisory npm response before the mail dependency was added; explicitly not a fresh complete dependency scan. |
| `docs/7even/evidence/dependency-audit-unavailable.txt` | Final npm advisory endpoint failure after a bounded network attempt; no current clean-audit claim. |
| `docs/7even/evidence/final-build.txt` | Final root build output containing TypeScript checking and the successful production Vite bundle. |
| `docs/7even/evidence/final-integration.txt` | Final 43-pass, zero-skip local integration evidence, including real PG/HTTP, process-kill/rollback/restart and injected provider/mailer contracts. |
| `docs/7even/evidence/final-lint.txt` | Successful final lint exit with zero errors, 162 warnings and four information diagnostics; no warning-free claim. |
| `docs/7even/evidence/final-unit.txt` | Final 153-pass, zero-skip engine/contracts/frontend-queue/checkout assertion output. |
| `docs/7even/evidence/reception-desktop.jpg` | Root-captured local reception workspace browser evidence. |
| `docs/7even/evidence/seasonal-build.txt` | Post-feature production build and TypeScript verification output, distinct from the original rebuild evidence. |
| `docs/7even/evidence/seasonal-integration.txt` | Post-feature combined 43-case local integration output; no real provider/bank/SMTP proof implied. |
| `docs/7even/evidence/seasonal-lint.txt` | Post-feature lint command output with existing warnings retained. |
| `docs/7even/evidence/seasonal-unit.txt` | Post-feature 205-case combined engine, contracts and frontend assertions, including season/calendar and brand checks. |
| `docs/7even/legacy-review/APREN_FILE_GUIDE.txt` | Original file-by-file notes covering every one of the 486 Apren tracked files at the pinned base commit. |
| `docs/7even/legacy-review/APREN_REVIEW.txt` | Original Apren purpose, architecture, 42 findings and assessment before the hospitality rebuild. |
| `docs/7even/legacy-review/APREN_REVIEW_DATA.json` | Machine-readable original inventory and stable finding order used to map all 42 findings in the implementation review. |
| `docs/7even/research/ACCEPTANCE_RESEARCH.txt` | Original finding coverage and test-design matrix, including superseding payment-model notes and remaining acceptance targets. |
| `docs/7even/research/DESIGN_RESEARCH.txt` | Local reference catalog plus Dribbble/Behance research and design direction/provenance notes. |
| `docs/7even/research/ENGINE_RESEARCH.txt` | Research notes on hospitality engine, Flutterwave contracts, database and reliable operational boundaries. |
| `docs/7even/research/FLUTTERWAVE_CONTRACT_ADDENDUM.txt` | Revised provider contract research superseding manual-payment assumptions, including split commission, webhook mode, uncertainty and settlement evidence. |
| `docs/security/tma.md` | Source-linked STRIDE threat model pinned to the base commit plus the historical pre-seasonal rebuild content hash. |
| `learn/2026-10-16-rebuild-seven.md` | Consolidated learning explanation of actual engine/backend/frontend changes, durable effects, limitations and self-check questions. |
| `learn/INDEX.md` | Index linking the consolidated 7even rebuild learning breakdown. |
| `package-lock.json` | Authoritative root dependency lock and workspace resolution. Prefer npm ci from the repository root. |
| `package.json` | Defines the four active npm workspaces, pinned development dependencies, overrides and explicit development/build/test/migration commands. |
| `packages/contracts/package.json` | Shared DTO/schema workspace with its Zod dependency and source export. |
| `packages/contracts/src/index.ts` | Canonical request validators, roles/sectors/states and typed API projections for frontend and backend. |
| `packages/contracts/test/contracts.test.ts` | Rejects privilege self-assignment, invalid quote quantities, inexact amounts and unstable sync identity. |
| `packages/engine/README.md` | Explains exact money, points, calendar/lifecycle and deterministic demand boundaries, including what callers must enforce. |
| `packages/engine/package.json` | Pure TypeScript domain-rule workspace and focused built-in Node test command. |
| `packages/engine/src/demand.ts` | Validated event-count evidence, readiness and goal-aware deterministic recommendations with reasons and policy version. |
| `packages/engine/src/index.ts` | Public engine export surface; no database or provider effects. |
| `packages/engine/src/lifecycle.ts` | Strict calendar date/range enumeration and allowed reservation state/action transitions. |
| `packages/engine/src/money.ts` | Bounded exact minor-unit conversion/display, half-up quote arithmetic, service commission and integer point earning. |
| `packages/engine/test/demand.test.ts` | Evidence validation, insufficient data, capacity/rate bounds, source-window handling and demand-goal rules. |
| `packages/engine/test/lifecycle.test.ts` | Calendar validity, leap dates/range bounds and legal/illegal lifecycle transitions. |
| `packages/engine/test/money.test.ts` | Money parsing, rounding, overflow, currencies, malformed inputs and point-rate boundaries. |
| `scripts/dev.mjs` | Starts only the modular platform API and Vite app on their configured local development ports; handles process shutdown. |
| `services/platform/package.json` | Single modular platform runtime dependencies and server/migrate/seed/test scripts. |
| `services/platform/src/accounts.ts` | Hashed single-use account recovery, password change/session revocation, private delivery and persistent per-account/IP abuse counters shared across workers. |
| `services/platform/src/app.ts` | Application construction, secure session/CSRF/origin middleware, route mounting, durable mutation keys, catalog/business/admin APIs and error translation. |
| `services/platform/src/auth.ts` | Salted scrypt password hashing, constant-time verification and opaque token hashing/generation. |
| `services/platform/src/benefits.ts` | Point-funded reward redemption, benefit consumption, gift/swap eligibility, proposal locks, ownership rotation and expiry. |
| `services/platform/src/db.ts` | PostgreSQL pool and rollback-safe transaction helpers, parameterized query wrappers and structured API errors. |
| `services/platform/src/migrate.ts` | Runs ordered SQL files in transactions under an advisory lock and refuses modified applied checksums. |
| `services/platform/src/operations.ts` | Venue and external payment-note APIs, operational queue/source health and admin moderation. |
| `services/platform/src/payments.ts` | Durable checkout/refund intents, independent receipt application, duplicate/late payments, compensating records and bounded settlement reconciliation. |
| `services/platform/src/provider.ts` | Explicit Flutterwave v3 HTTPS adapter, exact decimal parsing, hosted split request, verification/refund/settlement reads and isolated mock provider. |
| `services/platform/src/recoveryMailer.ts` | Optional lazily loaded installed Nodemailer TLS SMTP adapter with text-only recipient delivery; actual external delivery remains unverified. |
| `services/platform/src/reservations.ts` | Authoritative quotes, service windows, locked capacity allocation, hold expiry, access checks, lifecycle transitions and once-only point earning. |
| `services/platform/src/seed.ts` | Explicit nonproduction synthetic accounts, merchants, hospitality inventory and sample points; no implicit production defaults. |
| `services/platform/src/server.ts` | Local API listener and bounded periodic recovery loop with graceful-shutdown hooks. |
| `services/platform/src/store.ts` | DTO projections, tenant/venue guards, audit/outbox/notification helpers and exact balanced monetary/points journals. |
| `services/platform/src/worker.ts` | Recovers abandoned durable claims, expires holds/trades, leases provider inbox items, reconciles outcomes and consumes in-app notification outbox with bounded retries. |
| `tests/fixtures/recovery-child.ts` | Isolated IPC child fixture that pauses before COMMIT, raises a PostgreSQL exception or simulates an uncertain checkout for literal process-restart tests. |
| `tests/frontend/brand-theme.test.ts` | Asserts exact brand tokens/aliases, isolated proposed seasonal accents, contrast thresholds, distinct credited campaign assets and fixed installed-app metadata. |
| `tests/frontend/reception-queue.test.ts` | Uses fake IndexedDB to test acknowledgment, conflict retention, concurrent writes, in-flight action preservation and identity cleanup. |
| `tests/frontend/season.test.ts` | Every campaign month and Lagos midnight boundary, leap/New Year/timezone cases, invalid dates, live rollover, bounded scheduling, sleep/resume, clock correction and cleanup. |
| `tests/integration/accounts.test.ts` | Real PG recovery/walk-in claim, replay/expiry/races, CSRF and session revocation, delivery failure and durable account/IP throttling tests. |
| `tests/integration/auth.test.ts` | Proves password salts differ and verification rejects another password. |
| `tests/integration/platform.test.ts` | Real PostgreSQL HTTP acceptance for scoped overviews, inventory and points races, verified receipts, late/duplicate payments, refunds, settlement, sync and immutable journals. |
| `tests/integration/provider.test.ts` | Provider transport contract tests for exact amounts, numeric token preservation and frozen flat commission. |
| `tests/integration/recovery-crash.test.ts` | Real child-process SIGKILL, PG rollback and fresh-worker recovery assertions, including no repeated checkout after a synthetic possible charge; isolated test DB only. |
| `tests/integration/recovery-mailer.test.ts` | Checks missing/invalid SMTP configuration and an injected mail transport contract; does not contact a real SMTP service. |
| `tsconfig.json` | Strict shared no-emit TypeScript checking, NodeNext imports, browser/Node types and legacy exclusions. |
| `design/explorations/verification/seasonal/autumn-tablet.jpg` | Final tablet campaign screenshot after 13px caption refinement. |
| `design/explorations/verification/seasonal/autumn-mobile.jpg` | Final mobile campaign screenshot after 13px caption refinement. |
| `design/explorations/verification/seasonal/resume.json` | Browser resume after clock jump selects the current campaign without navigation. |
| `design/explorations/verification/seasonal/responsive.json` | 768px and 390px bounds, caption size and fixed action color measurements. |
| `design/explorations/verification/seasonal/seasons.json` | All four browser-selected accents, immutable core colors and loaded stock photography. |
| `design/explorations/verification/seasonal/reception.json` | Reception palette, absence of test clock, dialog Escape and focus restoration measurements. |
| `design/explorations/verification/seasonal/reception-dialog.jpg` | Reception benefit dialog with supplied core palette; no benefit consumed. |
| `learn/2026-10-16-automatic-seasonal-themes.md` | Learning breakdown of the automatic clock, core/season separation and verification limits. |

## Multi-provider additions, 18 October 2026

The older `final-*` and `seasonal-*` evidence rows above describe their recorded runs, not current verification totals. Current payment changes and limits are specified in `MULTI_PROVIDER_PAYMENTS.md`.

| File | Purpose |
|---|---|
| `apps/web/src/components/PaymentMethodDialog.tsx` | Shared read-only options and guarded fiat/USDC selection for customer booking, booking continuation and reception walk-ins. |
| `apps/web/src/lib/paymentWallet.ts` | Exact USDC display, Base/account checks, message signing and gas review before wallet-controlled transfers; no transport retry for uncertain sends. |
| `apps/web/src/lib/paymentWallet.test.ts` | Exact token formatting, network/payer boundaries and structured wallet rejection classification. |
| `apps/web/src/pages/customer/CryptoCheckoutPage.tsx` | Frozen quote, business destination, indicative valuation, ETH-fee review, wallet proof, finality refresh and original-hash recovery. |
| `apps/web/src/pages/workspace/BusinessPayments.tsx` | Provider-account status, business-wallet ownership submission and crypto commission owed. |
| `apps/web/src/pages/workspace/CryptoRefundDialog.tsx` | Merchant-controlled token return, fee review, original-payer destination, hash/finality checks and explicit mock completion. |
| `database/migrations/009_multi_provider_payments.sql` | Provider/method/mode lookups, historical route/journal backfill, provider-scoped uniqueness, account revisions and immutable crypto financial evidence. |
| `docs/7even/MULTI_PROVIDER_PAYMENTS.md` | Agreed routing, direct-wallet commission model, invariants, interfaces, external sources and release limits. |
| `packages/engine/src/paymentRouting.ts` | Exact NGN threshold and fixed routing revision; at most ₦50,000 uses Paystack, strictly above uses Flutterwave. |
| `packages/engine/test/payment-routing.test.ts` | Threshold equality/adjacency and malformed amount checks against the routing contract. |
| `services/platform/src/providerRegistry.ts` | Resolves each saved provider and execution mode; separates live adapters from isolated mocks and configured crypto. |
| `services/platform/src/paystackProvider.ts` | Integer-kobo hosted split checkout, server verification, normalized refunds, raw HMAC webhooks and bounded settlement reads. |
| `services/platform/src/cryptoProvider.ts` | Native-USDC/Base quotes, indicative FX freshness, EOA signatures, canonical/finalized exact transfer evidence and mock gateway. |
| `services/platform/src/paymentAccounts.ts` | Business wallet challenges, signed destination registration, admin review and provider-account/commission projections. |
| `tests/integration/crypto-provider.test.ts` | Exact quote arithmetic and injected Base/rate/signature/transfer/finality contracts; no real wallet transaction proof. |
| `tests/integration/paystack-provider.test.ts` | Injected Paystack initialization, response normalization, webhook authentication and provider failure contracts. |
| `tests/integration/multi-provider.test.ts` | Isolated PostgreSQL acceptance for provider routing, identities, receipts, crypto commission and refunds. |
| `tests/integration/payment-wallet.test.ts` | Signed business-wallet ownership, expiry, revision and admin/tenant boundaries against an isolated database. |

| `services/platform/src/paystackSettlement.ts` | Bounded report-only settlement reconciliation, whitelisted observations, durable exhaustion and no invented bank confirmation. |
| `tests/integration/paystack-settlement.test.ts` | Restricted-runtime evidence, mismatches, worker claims, lookup bounds and interrupted final-check recovery. |
| `tests/integration/payment-boundaries.test.ts` | Direct returns, spent-points shortfall, execution mode/network boundaries, reception privacy, shared transfer claims and wallet revision races. |
| `tests/integration/refund-observations.test.ts` | Concurrent contradictory completed refund evidence preserves accounting and appears in the authenticated admin exception queue. |
| `docs/7even/PAYMENT_VERIFICATION.md` | Accepted payment behavior, local command/browser evidence and explicit external release gaps. |

Existing `app.ts`, `payments.ts`, `store.ts`, `worker.ts`, shared contracts, seed, customer/reception entry points, admin and business screens use these interfaces. viem 2.57.7 is installed in the frontend/platform manifests and root lockfile. Real provider sandboxes, Base wallet transfers and SMTP delivery remain unverified.

## Original files and current historical paths

The original repository contained 486 tracked files. Every original file has an individual entry in [APREN_FILE_GUIDE.txt](legacy-review/APREN_FILE_GUIDE.txt), with machine-readable details in [APREN_REVIEW_DATA.json](legacy-review/APREN_REVIEW_DATA.json) and narrative assessment in [APREN_REVIEW.txt](legacy-review/APREN_REVIEW.txt). Those reports are pinned to `26d61a4aaf0ee87411b57df2ac94a5e5ad607e33` and describe the original bytes. [Implementation review](IMPLEMENTATION_REVIEW.md) maps each of the 42 original findings to replacement, exclusion or remaining proof.

Apply these path translations to inspect an original file now:

| Original path family | Current location or disposition |
|---|---|
| `services/assets`, `gateway`, `identity`, `intelligence`, `market`, `notification`, `shared`, `trade`, `wallet` | Same relative paths beneath `legacy/services/` |
| Root historical `*.sh` installers/restarts/patchers | `legacy/scripts/<original filename>` |
| `debug/` | `legacy/debug/` |
| `config/` | `legacy/config/` |
| Original `apps/web/src/` | `legacy/web-src/` |
| Original `apps/web/public/icons/` | `legacy/web-icons/` |
| Original root `README.md` | `legacy/README.apren.md` |
| Original root `package.json` | `legacy/package.json.reference` |
| Original nested `apps/web/package-lock.json` | `legacy/web-package-lock.json.reference` |
| Original active package/entry/build configuration replaced in place | Original bytes remain retrievable at the pinned Git commit; the active table describes each replacement |
| `legacy/README.md` | New quarantine explanation; not an original Apren file |

Do not execute historical shell scripts as a migration sequence. They retain author-specific paths and overwrite/kill behavior documented in the original review. The active runtime does not repair those historical scripts or claim that old food/evidence/intelligence interfaces remain supported. There is no legacy customer-data migration in this rebuild.

## How to read the code

Start with [architecture](ARCHITECTURE.md), the approved proposal and API contract, then read shared contracts and the pure engine. Follow a request from `apps/web/src/lib/api.ts` through `app.ts`, its domain module, PostgreSQL transaction/journal helpers and worker. Read the matching test and its stated limits. This shows where presentation ends, server authority begins and durable effects commit.
