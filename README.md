# 7even

7even is the user-facing hospitality brand for rooms, dining and experiences in Nigeria. Apren is the underlying intelligence engine; 7even owns the hospitality experience and reservation/payment workflows, while Apren provides food-asset, food-intelligence and food-economy capabilities behind a service boundary. The 7even rebuild UI remains the product users see.

The root workspace runs the 7even web app, the 7even platform API, and the Apren engine together. `packages/engine` contains 7even-specific pricing/lifecycle rules; `services/apren-engine` exposes Apren’s existing food-intelligence API. Remaining original services and generators are preserved in `legacy/` as historical reference, not as competing active runtimes.

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

Integration tests require a separate `TEST_DATABASE_URL` whose database name ends in `_test_db`. They reset only its `seven` schema and run serially. Set `TEST_RUNTIME_DATABASE_URL` to a restricted login for that same test database. The login must have `INHERIT` enabled and be a member of `seven_app` (for example, `GRANT seven_app TO seven_runtime WITH INHERIT TRUE;`). The fixture administrator migrates/seeds while HTTP requests run under the restricted login; the platform acceptance test now checks effective schema and group privileges before starting HTTP requests. Tests cover inventory races, provider doubles, balanced journals, account recovery, receipt replay, actual worker termination and transaction rollback. They do not certify Flutterwave or bank behavior.

`npm start` serves the built SPA and API on 7077. Set `APP_ORIGIN=http://127.0.0.1:7077` for a standalone local built-app check. All frontend calls use same-origin `/api` paths. Production needs an HTTPS reverse proxy, production credentials and the release review described below. No deployment has been made.

## Payments and rewards

Flutterwave Standard v3 hosted checkout uses server-owned subaccounts and independently verified payment evidence. 7even commission is 10% of service value after discounts, before separately stated taxes. The business bears the actual processing fee from its share. Integer kobo, immutable quote terms, balanced journals and durable request identities preserve the financial record.

Payment, reservation, settlement and refund states are distinct. Late payment does not restore expired inventory. Every actual extra charge is retained for review. An uncertain checkout or refund is reconciled before another financial dispatch. Points require verified payment and completed service, and are redeemable only against published business-funded rewards. Cash notes at reception do not establish a provider payment or earn points.

`PAYMENT_MODE=mock` is a visibly labelled local test double, forbidden in production. User confirmed the Flutterwave account is not ready. Real checkout, split fees, callbacks, refunds and bank settlement remain unverified. Configure test credentials and an approved test business subaccount before that validation.

## Reception and recovery

The reception app shares cloud inventory with online customers. Limited service actions use a durable local queue and a property-bound, versioned sync endpoint. Queued work remains pending until accepted. Conflicts are explicit. Private API responses are not service-worker cached. Supported browsers can install the built web app; a native installer and vendor PMS adapter are not included.

Password recovery securely claims an existing walk-in account. Development `.test` messages go only to ignored `.local/recovery-mailbox.json` with private file permissions. Production delivery uses configured TLS SMTP. Reset links are short-lived and single-use; tokens are hashed at rest and never logged. Without a configured mailer, production recovery returns a uniform unavailable response.

The optional SMTP path is implemented with Nodemailer 10.1.2, pinned to the official registry tarball in the lockfile. Registry downloads were unavailable during the final local session, so that newly added package and real SMTP delivery still need installation/verification. Default local operation and injected-mailer tests work without SMTP configured. Do not configure real SMTP until dependency installation and delivery checks succeed.

## Project map and review

- `apps/web`: responsive React interfaces and popup feedback.
- `packages/engine`: 7even-specific exact pricing, dates, lifecycle and measured demand rules.
- `packages/contracts`: shared request validation and response types.
- `services/platform`: 7even authentication, catalog, inventory, payments, rewards, sync and recovery.
- `services/apren-engine`: Apren food assets, food intelligence, food economy and food-brain API, promoted from the former legacy assets service.
- `database/migrations`: ordered, checksummed PostgreSQL schema changes.
- `tests`: unit, integration, concurrency and fault checks.
- `design/explorations`: three visual directions, sources and browser evidence.
- [File-by-file guide](docs/7even/FILE_GUIDE.md), [implementation review](docs/7even/IMPLEMENTATION_REVIEW.md), [API contract](docs/7even/API_CONTRACT.md), [operations](docs/7even/OPERATIONS.md), [threat model](docs/security/tma.md).

Qualified human review of money, authorization, tenancy and migrations is required before real-money release. External provider testing, security scan evidence, backup/restore drills, alerting and Nigerian payment/privacy obligations remain release requirements. Passing local tests does not establish production readiness.

Sources: [Flutterwave Standard](https://developer.flutterwave.com/docs/flutterwave-standard-1), [split payments](https://developer.flutterwave.com/docs/split-payments), [transaction verification](https://developer.flutterwave.com/docs/transaction-verification), [v3 webhooks](https://developer.flutterwave.com/docs/webhooks), [settlements](https://developer.flutterwave.com/docs/settlements), [Nodemailer SMTP](https://nodemailer.com/smtp). Design and photography credits are in `apps/web/public/media/SOURCES.txt`.
