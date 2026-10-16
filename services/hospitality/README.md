# 7even Hospitality service

## Current capabilities

- Public Uyo accommodation discovery backed by real property and room records.
- Hotel onboarding, room inventory, rates, addresses, contacts and optional coordinates.
- Admin review of property/contact/coordinate submissions. Straight-line distance is only returned for properties whose coordinates have been marked verified.
- Guest reservation requests, expiring holds, idempotency keys, confirmation and eligible cancellation.
- Reservation totals calculated from the selected rate unit and stay duration.
- Cash-at-property payment intents and property-side payment reconciliation.
- Optional Paystack transaction initialization, server-side verification, signed webhook processing and refund requests.

## Paystack configuration

Set these environment variables in the runtime environment (do not commit secret values):

- `PAYSTACK_SECRET_KEY` — the Paystack secret key for the intended test or live environment.
- `PAYSTACK_CALLBACK_URL` — optional public frontend URL to which Paystack redirects after checkout.
- `OSRM_BASE_URL` — optional OSRM routing service base URL, without `/route/v1/driving`. When configured, the service calculates driving distance and duration for up to 20 nearest verified properties and ranks routed properties by estimated driving time.

Configure the Paystack dashboard webhook URL as `https://YOUR_PUBLIC_API_HOST/api/hospitality/webhooks/paystack`. The webhook route validates `x-paystack-signature` against the raw request body using HMAC-SHA512, then verifies successful transactions server-side before marking reservations paid.

Without `PAYSTACK_SECRET_KEY`, online checkout, server-side verification and refund calls return a configuration error and no payment is marked paid. Do not test live charges with a live key until callback/webhook delivery and refund handling have been verified in the Paystack test environment.

## Location integrity

Property owners may submit latitude/longitude, but cannot mark them verified. An authenticated user with the `admin` role can review the property through the partner workspace. Straight-line distance uses Haversine calculation. When `OSRM_BASE_URL` is configured, driving distance and duration are requested for up to 20 nearest verified properties; failed routes remain without an ETA and are not assigned invented times. Origin coordinates are optional; preset terminal coordinates are planning pins and should be checked against the traveller's actual ticket/location.

## Verification

Run from the repository root:

```bash
npm run migrate:hospitality
npm run test:hospitality
npm run build:web
```

The migration runner is intentionally repeatable. Unit tests cover validation, reservation idempotency and pricing calculations. A live Paystack integration still requires test credentials and end-to-end testing against the Paystack test environment.

## Uyo discovery directory (unverified leads)

The first directory pull is stored in `data/uyo-hotel-directory.json`. It was collected sequentially from the public [Hotels.ng Uyo accommodation directory](https://hotels.ng/hotels-in-akwaibom/uyo), which advertised 236 nearby accommodation listings at capture time. The current crawl deduplicated those directory pages to 234 unique names; a separate 21-record sourced seed enriches selected candidates with public contact details where the source supplied them. The database import currently represents 239 unique lead records after name normalization and cross-source matching. Counts may change as directory pages change and as duplicates are reviewed.

Refresh the public directory snapshot with:

```bash
npm --workspace services/hospitality run pull:uyo-directory
```

Import the current snapshot and curated seed into the separate discovery-lead table with:

```bash
npm run migrate:hospitality
npm run import:uyo-directory
```

The importer is repeatable and does not create or modify `hospitality_properties`, room inventory, rates or public bookable listings. It stores candidates in `hospitality_discovery_leads` with status `new`, source URLs and metadata. These records may include hotels, guest houses, motels, serviced apartments, shortlets or nearby properties as classified by the directory. The directory is not guaranteed to represent every independent property in Uyo, and its listing/address information is not proof of current operation. Do not expose these leads as verified or bookable inventory. Before any lead is promoted to a public property, confirm partner consent, exact address and coordinates, direct contact, property type, room inventory, current rates, policies and availability freshness.

The source page includes a generic directory booking telephone number; the pull script intentionally does not store that number as each property's direct contact. The snapshot does not import public prices as current rates and does not claim availability.
