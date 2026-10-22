# 7even

7even is a Nigeria-first hotel booking platform. Its booking engine evaluates published hotel listings against current room inventory, check-in/check-out dates, requested room count, location and amenities; it removes unavailable stays and ranks the remaining matches on every search. The engine is part of the 7even rules package and reads the same PostgreSQL inventory that quotes and reservations use.

The optimizer is deterministic and explainable, not a trained demand model. It never changes a hotel's rate. Search results show a base-room subtotal estimate; the server calculates the final quote under current tax/discount policy and locks inventory again when a booking hold is created. Hotel availability is checked from live records on each request, and a hold can still fail if another guest books the last room first.

The active runtime consists of the 7even web app, platform API, shared contracts and hotel-booking engine. The engine is part of the workspace; no separate engine service is required.

## Run locally

Tested with Node.js 24.21 and PostgreSQL 18. Install from the root workspace:

```sh
npm ci
cp .env.example .env
```

Configure `DATABASE_URL` with a restricted login that inherits the `seven_app` group, and `MIGRATION_DATABASE_URL` with a separate local migration administrator. Create the empty database using your PostgreSQL administrator before applying migrations. The migration runner creates the named schema, owner/application/read-only groups, tables, grants and constraints. It does not import legacy customer data.

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

The frontend opens at http://127.0.0.1:5177 and proxies `/api` to 7077. Keep `APP_ORIGIN` identical to the browser origin, including 127.0.0.1 versus localhost. Sample accounts use `guest@seven.test`, `friend@seven.test`, `host@seven.test`, `reception@seven.test` and `admin@seven.test`. Seed uses `SEED_PASSWORD` or generates a private development password. It is explicit, idempotent and forbidden in production. The local task configuration is ignored by Git.

In the current local workspace, database credentials and the generated seed password are already in the ignored `.env`. Never copy that file into a release or share it.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm start
```

Integration tests require a separate `TEST_DATABASE_URL` whose database name ends in `_test_db`. They reset only its `seven` schema and run serially. Set `TEST_RUNTIME_DATABASE_URL` to a restricted login for that same test database. The login must have `INHERIT` enabled and be a member of `seven_app` (for example, `GRANT seven_app TO seven_runtime WITH INHERIT TRUE;`). The fixture administrator migrates/seeds while HTTP requests run under the restricted login; acceptance checks effective schema and group privileges before starting HTTP requests. Tests cover inventory races, provider doubles, balanced journals, account recovery, provider-scoped replay, worker termination and transaction rollback. Local doubles do not certify provider sandboxes, bank credit or Base wallet delivery.

`npm start` serves the built SPA and API on 7077. Set `APP_ORIGIN=http://127.0.0.1:7077` for a standalone local built-app check. All frontend calls use same-origin `/api` paths. Production needs an HTTPS reverse proxy, production credentials and the release review described below. Review deployed configuration separately from local checks.

## Optional stay search

Guests can describe a stay on Explore. Set server-only `OPENAI_API_KEY` and an explicit `OPENAI_MODEL` that your API account supports for Structured Outputs. Both are required; no model is silently selected. The request is sent to OpenAI with `store: false`, an eight-second timeout and strict output validation. Missing dates require clarification. The service translates requests into filters; the existing engine remains responsible for availability, ranking, pricing and bookings. Without configuration, the endpoint returns a clear unavailable response and the normal filters remain usable.

The public endpoint shares a PostgreSQL limit of 20 attempts per IP per 15-minute window across workers. Do not include personal or payment information in a stay request. Local tests use provider doubles; live OpenAI account/model access and quality still need verification.

Set `SEVEN_PREVIEW_READ_ONLY=true` for a preview that must reject HTTP account, booking, payment, refund and webhook mutations with retryable `503` responses. The stay-search endpoint remains available and writes its rate-limit counters. This flag is ignored when `VERCEL_ENV=production`. It does not replace a separate preview database or disable external background workers.

## Payments and rewards

Fiat totals of ₦50,000 or less use Paystack. Totals strictly above ₦50,000 use Flutterwave Standard v3. Routing uses the accepted payable total, including stated taxes, and is fixed before dispatch. Each business needs a verified subaccount for each provider. There is no automatic fallback to another live provider. 7even earns 10% of the service value after discounts, excluding separately stated taxes; actual provider processing fees reduce the business share.

Customers can instead pay native USDC on Base directly to an approved business wallet. The full token amount reaches that wallet, and the business separately owes 7even its 10% commission in NGN. Commission owed is a receivable, not collected platform cash. The customer reviews the wallet's ETH network fee before sending. 7even holds no wallet keys and never signs merchant transfers.

USDC checkout freezes the NGN basis, indicative rate, exact six-decimal token amount, payer, destination and network for at most five minutes. It allows a 60-minute reservation hold for final confirmation. The server requires the exact token transfer and finalized chain evidence; a pasted hash or signature alone is not payment. Standard externally owned wallet accounts are supported; smart contract wallets are not. The rate is a checkout valuation, not an exchange or redemption service.

Payment, reservation, delivery and refund states are distinct. A Paystack receipt does not establish bank settlement; missing per-transaction bank evidence stays pending for review. Crypto records wallet delivery rather than bank settlement. Late or mismatched payment does not restore expired capacity. Uncertain effects are reconciled before another dispatch, and actual extra charges remain visible. A crypto refund first creates a merchant return request; only a verified return from the original business wallet to the original payer completes it. Points still require verified payment and completed service. Reception cash notes do not establish payment or earn points.

`PAYMENT_MODE=mock` enables labelled local doubles and is forbidden in production. `PAYMENT_MODE=live` uses server-only Flutterwave and Paystack credentials. Live crypto is disabled by default; configure `CRYPTO_ENABLED`, `CRYPTO_CHAIN_ID` and `BASE_RPC_URL` as described in [operations](docs/7even/OPERATIONS.md). Use Base Sepolia (`84532`) for external test work; reviewed production crypto uses Base mainnet (`8453`). `.env.example` contains names and blank credential values only.

Real provider checkout, webhooks, splits, refunds, bank settlement and Base testnet wallet transactions remain unverified. The Flutterwave account is not ready. Approved provider accounts, wallets and external test credentials are still needed. See the [multi-provider implementation brief](docs/7even/MULTI_PROVIDER_PAYMENTS.md) and [local verification record](docs/7even/PAYMENT_VERIFICATION.md).

## Reception and recovery

The reception app shares cloud inventory with online customers. Limited service actions use a durable local queue and a property-bound, versioned sync endpoint. Queued work remains pending until accepted. Conflicts are explicit. Private API responses are not service-worker cached. Supported browsers can install the built web app; a native installer and vendor PMS adapter are not included.

Password recovery securely claims an existing walk-in account. Development `.test` messages go only to ignored `.local/recovery-mailbox.json` with private file permissions. Production delivery uses configured TLS SMTP. Reset links are short-lived and single-use; tokens are hashed at rest and never logged. Without a configured mailer, production recovery returns a uniform unavailable response.

Google, Apple and passkey sign-in share the existing sessions. Connect provider accounts and add passkeys from Profile after signing in. Google and Apple remain unavailable until their server credentials and callback URLs are configured. See [sign-in setup](docs/sign-in-setup.md) for environment names, supported domains, testing limits and the required migration/release steps.

The optional SMTP adapter uses installed Nodemailer 10.1.2. Its earlier package-download blocker is resolved; real SMTP acceptance and mailbox delivery remain untested. The Base adapter and browser wallet actions use installed viem 2.57.7. Both are pinned by the root lockfile.

## Project map and review

- `apps/web`: responsive React interfaces and popup feedback.
- `packages/engine`: 7even hotel availability filtering, explainable booking-match ranking, exact pricing, stay dates and lifecycle rules.
- `packages/contracts`: shared request validation and response types.
- `services/platform`: 7even authentication, catalog, inventory, payments, rewards, sync and recovery.
- `database/migrations`: ordered, checksummed PostgreSQL schema changes.
- `tests`: unit, integration, concurrency and fault checks.
- `design/explorations`: three visual directions, sources and browser evidence.
- [File-by-file guide](docs/7even/FILE_GUIDE.md), [implementation review](docs/7even/IMPLEMENTATION_REVIEW.md), [API contract](docs/7even/API_CONTRACT.md), [operations](docs/7even/OPERATIONS.md), [threat model](docs/security/tma.md).

Qualified human review of money, authorization, tenancy and migrations is required before real-money release. External provider testing, security scan evidence, backup/restore drills, alerting and Nigerian payment/privacy obligations remain release requirements. Passing local tests does not establish production readiness.

Sources: [Flutterwave Standard](https://developer.flutterwave.com/docs/flutterwave-standard-1), [split payments](https://developer.flutterwave.com/docs/split-payments), [v3 webhooks](https://developer.flutterwave.com/docs/webhooks), [Paystack transactions](https://paystack.com/docs/api/transaction/), [Paystack splits](https://paystack.com/docs/payments/split-payments/), [Paystack webhooks](https://paystack.com/docs/payments/webhooks/), [native USDC contracts](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Base finality](https://docs.base.org/base-chain/specs/protocol/consensus/derivation), [Nodemailer SMTP](https://nodemailer.com/smtp). Design and photography credits are in `apps/web/public/media/SOURCES.txt`.
