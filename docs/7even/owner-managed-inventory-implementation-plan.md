# 7EVEN owner-managed hotel inventory implementation plan

Status: implementation plan attached to draft PR #252. No merge, production migration, production data change, or production deployment is authorised by this document.

## Product operating model

7EVEN is installed on the hotel owner's device and on devices belonging to authorised staff. The owner creates the business account, registers the business and venue, creates the public hotel listing, configures room categories and rate plans, and manages availability directly in 7EVEN. Availability changes must feed customer search and booking through the existing inventory authority.

A website, PMS, or channel manager is not a prerequisite. PMS/channel-manager connectivity is a later optional integration. Do not make 7EVEN staff the default inventory operator, and do not make a booking request the substitute for live inventory.

## Existing foundation

- PR #252 adds `stay_room_types`, `stay_rate_plans`, and `stay_nightly_rates`.
- Existing `seven.offerings` remains the public listing entity.
- Existing `seven.inventory_windows` remains the only authoritative capacity/allocation counter.
- Existing `POST /api/business/offerings/:id/availability` writes manual inventory with row locking, allocation checks, revision increments, source stamping, and audit.
- Existing quote, reservation, allocation, payment verification, expiry, cancellation, and freshness paths remain authoritative. Do not create a parallel booking engine.

## Owner and staff workflow

1. Owner installs 7EVEN, creates an account, and completes business registration.
2. Owner creates or selects the business venue and submits factual business details for the existing verification process.
3. Owner creates each STAY offering as a customer-facing room category, then supplies structured occupancy and bed configuration.
4. Owner configures one or more rate plans with currency, inclusions, refundability, and explicit cancellation terms.
5. Owner enters nightly prices and restrictions for each date. Missing nightly prices are unavailable; never fall back silently to the generic offering price.
6. Owner enters the physical room count only when known, then confirms sellable capacity for each date. The existing inventory window is authoritative and allocated rooms cannot be displaced.
7. Owner reviews the listing and publishes only when the existing verification, factual data, rate completeness, and freshness gates pass.
8. Owner and authorised reception staff use the calendar to monitor reservations and remaining rooms. Reception scope is limited to assigned venues and does not grant owner-only rate configuration.

## API implementation contract

All mutations must use the existing authenticated actor, `mutate` idempotency wrapper, tenant enforcement, venue enforcement, revision checks, and `S.audit`. Business and venue IDs must be derived from authenticated membership and offering ownership, not trusted from client payloads.

Required endpoints (exact route names may follow repository conventions):

- Create/update/deactivate room-type configuration for a STAY offering. Owner-only. Validate that the offering belongs to the actor's business and is a STAY offering.
- Create/update/deactivate rate plans for a room type. Owner-only. Keep currency and cancellation terms explicit; reject cross-room references.
- Bulk upsert nightly rates and restrictions over explicit service dates. Owner-only. Require integer minor-unit amounts, valid date bounds, and optimistic revisions. Do not synthesize missing dates.
- Read a date-range inventory calendar. Owner and reception may read only within their business; reception is restricted to assigned venues.
- Update per-night capacity through the existing inventory-window mutation logic. Owner and authorised reception may update only within their permitted venue scope. Keep the existing allocation, PMS ownership, revision, freshness, and audit protections.

## Mobile business-device calendar

The business workspace must be usable on a phone. It should show:

- Selected venue and room category.
- Date navigation and a compact date grid.
- For each night: total capacity, allocated rooms, remaining rooms, manual confirmation timestamp/source, and inventory status.
- Per-night rate-plan price and restrictions, clearly separated from capacity.
- Actions to set or close a date range, bulk-edit prices, and confirm availability.
- Clear conflict messages when another staff member changes the revision or when allocated rooms prevent a reduction.
- No optimistic success state until the server confirms the mutation.

Do not display a date as bookable when the price is missing, inventory is missing/stale/unknown, the date is closed, the business is not eligible, or any existing booking gate fails.

## Quote and booking integration

The customer quote request must select a room type and rate plan. Quote creation must resolve one active rate plan and one nightly rate for every occupied night, validate occupancy and arrival/departure restrictions, and snapshot all nightly prices, currency, taxes, cancellation terms, room type, dates, and quantity. Check-out day is excluded from occupied nights.

Quote creation remains non-allocating. Reservation creation must continue to lock every required inventory window in deterministic order, re-check freshness and capacity, and create the existing reservation and allocations in one transaction. Never allow a quote snapshot to allocate a different room type or date range. Never silently reprice an accepted quote.

## Required tests

- Owner can create and manage only their own room types, rate plans, and nightly rates.
- Cross-tenant access fails without leaking whether another tenant's records exist.
- Reception can read and update only assigned venue inventory and cannot edit room/rate configuration.
- Only STAY offerings can receive room-type configuration.
- Optimistic revision conflicts are explicit and do not overwrite newer changes.
- Bulk date updates validate every date and amount atomically.
- Missing nightly rates, missing inventory windows, closed dates, stale/unknown inventory, and inactive rate plans fail closed.
- Check-out day is excluded; every occupied night is included.
- Capacity cannot be reduced below active allocations; PMS-owned inventory cannot be overwritten manually.
- Concurrent last-room booking attempts cannot oversell inventory.
- Quote snapshots preserve nightly prices and policy terms after later edits.
- Idempotent retries do not duplicate audit events or inventory mutations.
- Tests use disposable PostgreSQL, never production.

## Delivery gates

1. Verify PR #252 migration and CI; reconcile migration history before any database execution.
2. Implement and test tenant-scoped room/rate APIs.
3. Implement and test the mobile inventory calendar.
4. Connect rate-plan snapshots to quote and reservation creation.
5. Complete business onboarding, public listing, customer booking, reception operations, cancellation, notifications, security, offline and responsive QA.
6. Only after the complete release passes review and the user explicitly approves: merge the prepared work in a controlled sequence, apply production migrations, deploy once to the production URL, and verify.

Until that explicit approval, all work stays on feature branches/draft PRs. No production migration, production data write, or production deployment.
