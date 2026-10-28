# Inventory readiness and empty search results

An empty listings response does not by itself mean the database connection has failed. Keep directory leads separate from inventory that guests can book.

## Confirmed production evidence

Public, read-only checks during the 22 October 2026 investigation returned:

| Endpoint | Observed response |
| --- | --- |
| `/api/health/live` | `status: ok` |
| `/api/health/ready` | `status: ready`, PostgreSQL, live payment mode |
| `/api/engine/booking/health` | `publishedHotelOffers: 0` |
| `/api/offerings?kind=STAY&pageSize=1` | Empty array |
| `/api/directory?kind=STAY&pageSize=1` | Seven hotel directory leads, marked `DIRECTORY_ONLY` and `bookable: false` |

The engine health count includes published hotel offerings whose businesses are approved. Zero at that gate explains the empty hotel search before verification, location, freshness or capacity checks are applied. It does not reveal whether the underlying records are absent, unpublished or attached to unapproved businesses. These are observations from that investigation, not a promise about current production counts.

## Investigate with an administrator account

1. Open `/admin/login` using an account already assigned the ADMIN role. The public navigation does not advertise this link. Knowing the URL does not grant access.
2. Open `/admin/inventory`. The database status comes from a PostgreSQL readiness query that checks the current required migration, booking-recovery event table, and quote attribution column, not just the existence of an old migration-ledger row. A `503 SCHEMA_NOT_READY` requires an authorized operator to inspect migration state; do not apply migrations blindly.
3. Compare businesses, listings, published listings, eligible listings and blocked listings. Totals include every matching record, even when detail lists are capped.
4. Inspect the affected business. For a business outside the latest 100 summaries, find it in the paginated business records and open `/admin/inventory?businessId=<business UUID>`. The corresponding read-only API is `/api/admin/listing-readiness?businessId=<business UUID>`.
5. Follow the blocker shown for each offering. Missing state is a location-search warning, not a general publication blocker.

## Resolve the actual blocker

| Code | Required action |
| --- | --- |
| `BUSINESS_NOT_APPROVED` | Complete the documented review. An authorized administrator approves the business with evidence. |
| `HOTEL_VERIFICATION_REQUIRED` | Complete the hotel verification checklist and agreed inventory freshness window. |
| `NO_OFFERINGS` | The business adds its actual room, dining or experience offering after approval. |
| `OFFERING_UNPUBLISHED` | The business reviews the real details and publishes the offering. |
| `NO_INVENTORY` | The business adds genuine service dates and capacity. |
| `INVENTORY_EXPIRED` | Add future availability; existing dates have ended. |
| `INVENTORY_STALE` | Ask the business to reconfirm actual remaining capacity. |
| `INVENTORY_SOLD_OUT` | Check allocations and actual capacity. Do not increase capacity to conceal bookings. |
| `INVENTORY_CONFLICT` | Review duplicate available windows on the same room-night. A dining offer converted to a stay may retain multiple sittings. Correct the offering type or add a separate room offering with genuine nightly inventory. |
| `INVENTORY_PROJECTION_LIMIT` | Ask operations to review the availability horizon. Capacity exists beyond the first 500 fresh current windows evaluated by hotel search. Do not fabricate capacity or delete history to conceal this limit. |
| `STATE_MISSING` / `STATE_UNRECOGNIZED` | Save the correct Nigerian state so state and city searches can find the offering. |

Hotel eligibility requires approval, publication, verification and current, fresh capacity. Selected dates and room counts are checked separately for every requested night. Dining and experience discovery preserve their existing sector rules; a visible listing is not a booking guarantee.

Hotel search requires exactly one available window for a selected service date. Readiness applies the same rule to the same bounded search projection, while its inventory counts include every window. Duplicate dates do not block the whole offering if another projected service date is unambiguous.

Business and reception screens read current and future inventory before the 500-window projection limit. Stale upcoming windows stay visible privately for reconfirmation. Public projections keep their freshness filter. Readiness totals include all inventory windows; the dashboard honestly labels bounded details.

## Verify and escalate

After the business corrects the real data, refresh listing checks and repeat the public search with the intended state, city, dates and room count. If readiness is connected but the business has no eligible published hotel offering, continue onboarding rather than changing connection settings.

If readiness fails, capture the time, endpoint, HTTP status and request ID. Check deployment logs, migration status and database connectivity with the authorized operator. Never put connection strings, session cookies, provider credentials or review evidence in an issue or screenshot.

Do not seed production, turn directory leads into bookable inventory, alter timestamps, bypass review or fabricate availability to make the endpoint nonempty. Obtain actual partner inventory and follow the existing approval process.
