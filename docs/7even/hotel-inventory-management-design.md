# 7EVEN hotel inventory management design

Status: design proposal for review. This document does not apply a database migration, change a live API, write inventory, or connect a PMS.

## 1. Objective

Give an authorised hotel team a reliable way to configure room categories, rate plans, nightly prices, and sellable room counts through 7EVEN, even when the property has no website or PMS.

The customer booking path must continue to use the existing quote, reservation, allocation, payment-verification, expiry, and cancellation lifecycle. Do not create a parallel reservation engine.

## 2. Existing platform to preserve

The current platform already provides:

- `businesses`, `venues`, and `memberships` as the tenant and venue authority boundary.
- `offerings` as the published hospitality listing.
- `inventory_windows` as date/time capacity, including `capacity`, `allocated_count`, `revision`, `inventory_confirmed_at`, and `inventory_source` (`MANUAL`, `PMS`, or `UNKNOWN`). Legacy rows remain `UNKNOWN` until an authorised owner reconfirms them; new owner-entered windows are `MANUAL`.
- A single database freshness policy accepts PMS confirmations for five minutes and manual confirmations for the property's approved 1–168-hour window. Unknown sources, missing/future timestamps, and expired confirmations are not bookable. Search, quote creation, and reservation allocation all call the same policy; reservation allocation rechecks while holding the inventory row lock.
- `quotes` as immutable amount and terms snapshots; creating a quote does not reserve stock.
- `reservations` and `allocations` for time-limited holds and allocated capacity.
- Existing reservation expiry/release logic and payment attempts separated from reservation state.
- Tenant and venue checks through `requireTenant` and `requireVenue`.

The current generic offering price is not enough for hotel operations: it cannot represent several rate plans with different prices and restrictions for each room category and each night.

## 3. Proposed relational model

Use the existing STAY offering as the customer-facing room-category listing and attach hotel-specific records to it. This preserves current discovery and reservation references.

### `stay_room_types`

One row per STAY offering (unique `offering_id`), containing structured operational facts such as:

- `room_type_id` UUID primary key
- `offering_id` unique FK to `seven.offerings`
- `max_occupancy` positive integer
- `bed_configuration` and optional room attributes
- `total_rooms` nullable integer where the property can verify a physical count
- `is_active`, `revision`, timestamps

The offering remains the public description/media/listing record. Structured room facts must not be inferred from its free-text description.

### `stay_rate_plans`

One or more rate plans per room type:

- `rate_plan_id` UUID primary key
- `room_type_id` FK
- stable `code`, `name`
- `currency_code` ISO 4217
- `meal_plan` / inclusions
- `refundable` nullable boolean and explicit cancellation policy text/version
- `is_active`, `revision`, timestamps

A room type can have multiple plans (for example, flexible and non-refundable). A rate plan must belong to the same room type as every nightly price and inventory row that references it.

### `stay_nightly_rates`

One row per rate plan and hotel-local service date:

- `rate_plan_id` FK
- `service_date` DATE
- `amount_minor` non-negative BIGINT
- optional per-night restrictions: closed-to-arrival, closed-to-departure, minimum stay, maximum stay
- `revision`, timestamps
- primary/unique key on (`rate_plan_id`, `service_date`)

Store money as integer minor units. Do not use floating point. Do not silently fill missing nightly prices from the generic offering price.

### Inventory authority

Keep `inventory_windows` as the authoritative allocation counter for each room-category night. A room-type record maps one-to-one to its STAY offering, so its existing inventory window is the per-night capacity row.

For hotel nights, generate each window using midnight-to-midnight in the venue's IANA timezone, while retaining timestamptz storage. A stay from check-in date D to check-out date E consumes nights D through E-1; checkout day is not an occupied night.

The existing `capacity - allocated_count` calculation remains the sellable count. A manual availability edit must:
- be scoped to the correct business and venue;
- lock the affected window row;
- reject a capacity reduction below current allocations;
- increment revision;
- record who changed it and why;
- update `inventory_confirmed_at` only after an authorised person actually confirms the count.

Do not add a second inventory counter table unless later code inspection proves the current allocation model cannot express a required operational state.

## 4. Quote and reservation integration

Extend the existing quote contract with an explicit `ratePlanId`. For every requested night:

1. Resolve the active room type and rate plan under the same business/venue.
2. Require one valid nightly rate for that exact rate plan and date.
3. Require one current inventory window for that room type and date.
4. Enforce arrival/departure restrictions and minimum/maximum stay.
5. Validate guest count against room-type occupancy.
6. Calculate a deterministic total from the sum of nightly integer prices, quantity, tax and commission rules.
7. Save the selected rate plan, every night, per-night amount, currency, policy, occupancy and cancellation terms in the immutable quote snapshot.

Quote creation remains non-allocating. Creating a reservation must continue to lock all relevant inventory windows in deterministic sorted order, re-check capacity and freshness, then create the existing reservation and allocations in one database transaction. A quote must not be allowed to allocate a different room type or dates from those in its snapshot.

A quote is a time-bounded price/terms offer. The implementation must explicitly define whether a rate-plan deactivation invalidates unclaimed quotes; it must never silently reprice an already accepted quote. This policy is a required test case before implementation.

Payment provider callbacks or client claims must not create or confirm inventory. Reservation state and payment verification remain separate.

## 5. Hotel workspace permissions

All write operations must derive business and venue scope from the authenticated membership, not from a client-supplied business ID alone.

| Operation | Business owner | Reception |
|---|---|---|
| Create/edit room category | Yes | No |
| Create/edit/disable rate plan | Yes | No |
| Set nightly prices | Yes | No |
| View room calendar and reservations | Yes | Assigned venue only |
| Update day-level room availability | Yes | Assigned venue only, with audit trail |
| Create/manage guest reservation and check-in workflow | Yes | Assigned venue only |
| Change business verification, payout or owner membership | Existing owner/admin rules only | No |

Admin access remains governed by existing platform rules. Do not weaken RLS, tenant isolation, venue checks, or the existing owner-only checks to make a route easier to implement.

If operational discovery shows that reception staff must edit rates, add a separately scoped capability rather than granting owner privileges.

## 6. Manual-first supply onboarding

The first release should support manual inventory entry by the verified hotel owner or an authorised 7EVEN operations user acting with recorded approval.

A hotel without a website or PMS can still be onboarded:
- create/verify the canonical business and venue;
- add room categories and factual amenities;
- enter the room count and per-night sellable inventory;
- add one or more rate plans and nightly prices;
- confirm cancellation terms and restrictions;
- review a preview before publishing.

Do not publish a room as bookable until the business verification gate, required room/rate data, and current inventory confirmation all pass. Missing photos do not block internal schema or workspace work; missing factual details must not be invented.

## 7. PMS integration boundary

The existing provider-neutral PMS adapter is observation-only and intentionally fails closed. Kiniz's PMS/channel manager, written authorization, API access, credentials, and external property mapping are not confirmed.

Keep the first inventory-management release manual-first. A later PMS connector may import room types, rate plans, nightly prices, restrictions, and source timestamps only after partner authorization. Do not allow a read-only adapter to write reservations, rates, or stock to a vendor system.

A PMS snapshot must be rejected for booking when timestamps are missing, future-dated, invalid, or stale. The documented default freshness contract is five minutes for PMS and two minutes for other trusted sources, subject to partner SLA validation. PR #227 currently contains the helper-default correction and remains open; it is not treated as merged or production-ready.

## 8. Migration and API implementation sequence

Before writing a migration:
1. Reconcile the repository migration files, `seven.migrations` ledger, and Supabase migration history. Resolve duplicate or missing version identifiers first.
2. Confirm exact live column names, constraints, triggers, RLS policies, and grants for the existing inventory/quote/reservation tables.
3. Confirm the current source route contracts and tests on the latest main commit.

Then implement in isolated, reviewable slices:
1. Additive schema for room types, rate plans, and nightly rates; explicit grants, RLS, indexes, foreign keys and constraints.
2. Owner-scoped room/rate CRUD and reception-scoped availability operations, with idempotency and audit events.
3. Quote calculation and immutable nightly line-item snapshots using the existing reservation engine.
4. Business workspace calendar and room/rate forms.
5. Disposable-PostgreSQL tests and concurrency tests before any controlled pilot.

Do not mutate production data or run a production migration as part of this design checkpoint.

## 9. Required tests and acceptance gates

- Cross-tenant owner cannot read or change another hotel's room types, rates, or inventory.
- Reception cannot access an unassigned venue or edit owner-only configuration.
- No rate, no inventory row, invalid occupancy, or closed-to-arrival/departure date fails closed.
- Check-out date is excluded from occupied nights; all intermediate nights are included.
- Nightly totals, tax and commission use integer minor units and preserve the quote snapshot.
- Concurrent requests for the last room cannot oversell it.
- A capacity reduction below active allocations is rejected.
- Expired holds release each nightly allocation exactly once.
- Cancellation/release does not corrupt historical reservations or quote snapshots.
- Stale/unknown PMS inventory cannot be booked.
- Payment failure or unverified payment never becomes a confirmed reservation.
- All tests run against disposable PostgreSQL, never the production database.

## 10. Explicitly out of scope

- Selecting or connecting a PMS vendor before Kiniz confirms its system.
- Vendor write APIs or channel-manager rate/stock updates.
- Production migration execution, production data edits, or production deployment.
- New payment-provider behavior or changes to existing payment/refund state machines.
- Fabricated hotel content, availability, prices, photos, or amenities.
