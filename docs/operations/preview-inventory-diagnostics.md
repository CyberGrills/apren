# 7even Preview Inventory Pipeline — Diagnostic Runbook

## Purpose

Restore a trustworthy hotel-search path in the isolated Preview environment before changing inventory logic, onboarding a hotel, or revisiting sign-in. This runbook separates a database/configuration failure from missing records, publication/verification blockers, stale inventory, and search-query defects.

## Guardrails

- Work only on `feat/7even-preview-inventory-diagnostics-20261027` and its Preview deployment.
- Do not change Production variables, database records, migrations, or deployment aliases.
- Do not seed synthetic inventory into public search. Test fixtures must stay in isolated test databases and be labelled synthetic.
- Never put credentials, connection strings, OAuth tokens, or guest data in logs, PR comments, screenshots, or this document.
- Do not treat a directory record, sample listing, or stale snapshot as bookable inventory.
- Do not run write-oriented tests unless their database URL is verified as disposable and ends in `_test_db`.

## Diagnostic order

### 1. Confirm the exact Preview deployment

Record the deployment URL, branch, commit SHA, build result, and Preview environment. Verify that the deployment is built from this branch; do not infer that a green deployment means its database is connected.

### 2. Check database readiness

Request `GET /api/health/ready`.

- **200 / ready:** the handler successfully queried `seven.migrations`; proceed to inventory counts.
- **503 or connection error:** capture the redacted error code, request ID, deployment SHA, and timestamp. Inspect only Preview-scoped database variables and connection logs. Do not paste secret values into the issue.
- **Missing route / 404:** confirm deployment artifact and API routing before changing database configuration.

This endpoint currently checks a migration marker and payment readiness; it is not proof that hotel records exist or are bookable.

### 3. Check the booking inventory count

Request `GET /api/engine/booking/health`.

Record `publishedHotelOffers` and response status.

- **Route fails:** treat as a runtime/database/schema failure until proven otherwise.
- **Count is zero:** continue to the admin readiness report; do not create placeholder hotels to make the number non-zero.
- **Count is positive but search is empty:** inspect verification, inventory freshness, dates, capacity, city/state filters, and projection eligibility.

The count is currently a broad count of published offers for approved STAY businesses; it does not independently prove fresh nightly availability.

### 4. Check the public search result

Request `GET /api/offerings?kind=STAY&pageSize=3` with no location or date filters first. Then repeat with one filter at a time.

Record status, response error code, result count, request ID, and deployment SHA. Do not record personal data.

- **503:** resolve the underlying dependency/runtime error first.
- **200 with an empty array:** continue to the admin readiness report.
- **Results appear without filters but disappear with a filter:** isolate the specific city, state, check-in/out, room-count, or amenity predicate. Verify dates are valid and check-out is after check-in.
- **Results appear but cannot be booked:** keep them non-bookable while room-night availability, rate, currency, fees, restrictions, and cancellation terms are reconciled.

### 5. Use the admin listing-readiness report

With an authorized Preview administrator session, request `GET /api/admin/listing-readiness`. This endpoint requires the ADMIN role; do not weaken authorization to make diagnosis easier.

Record aggregate totals and the blocker codes for each relevant test/property. Interpret common blockers as follows:

| Blocker | Next evidence to inspect |
| --- | --- |
| `BUSINESS_NOT_APPROVED` | Business workflow state and approval audit |
| `OFFERING_UNPUBLISHED` | Offering publication state and operator intent |
| `HOTEL_VERIFICATION_REQUIRED` | Completed verification checklist and evidence |
| `NO_INVENTORY` | Existence of room-night inventory windows |
| `INVENTORY_EXPIRED` | Inventory date range and end timestamps |
| `INVENTORY_STALE` | Last operator/provider confirmation and configured freshness window |
| `INVENTORY_SOLD_OUT` | Capacity versus allocated count for requested dates |
| `INVENTORY_PROJECTION_LIMIT` | Projection window and candidate eligibility query |
| `INVENTORY_CONFLICT` | Room-night/date continuity and projection reconciliation |

The readiness report is the next evidence source; do not guess which blocker is responsible from a zero-result search alone.

### 6. Verify the query against the schema and fixtures

Only after Steps 2–5 identify a query-level issue:

1. Reproduce it in an isolated `_test_db` using the existing hotel-inventory integration test.
2. Add a regression test for the exact blocker or filter combination.
3. Compare expected versus actual candidate IDs, nightly capacity, freshness, and final projections.
4. Check multi-night completeness, room count, Lagos date boundaries, duplicate room/rate records, and stale/future timestamps.
5. Run typecheck, unit tests, relevant integration tests, and CI. If integration tests are skipped because no disposable database is configured, report them as skipped—not passed.

Do not loosen verification/freshness gates or change the ranking policy to hide missing source data.

## Completion criteria

- Preview readiness succeeds against the intended Preview database.
- Aggregate counts explain the path from business → approved business → published STAY offer → verified property → fresh inventory → date/room-eligible search result.
- Unfiltered and date-filtered search behavior is covered by regression tests.
- No synthetic fixture appears in public search.
- Existing Production configuration, inventory, and deployment remain untouched.
- Evidence includes the tested commit, CI result, redacted endpoint statuses, and remaining blockers.

## Evidence log template

- Date/time (UTC):
- Branch / commit:
- Preview deployment URL:
- `/api/health/ready` status:
- `/api/engine/booking/health` status and `publishedHotelOffers`:
- Unfiltered `/api/offerings?kind=STAY&pageSize=3` status and result count:
- Admin readiness totals and blocker codes (redacted):
- Reproduction / test name:
- CI status:
- Root cause confirmed? (yes/no; evidence):
- Production untouched? (yes/no):
