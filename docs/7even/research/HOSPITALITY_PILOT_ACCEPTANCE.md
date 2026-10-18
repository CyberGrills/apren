> Ported from PR #2 as a requirements reference. The active 7even platform architecture remains authoritative; this document does not authorize importing PR #2's parallel hospitality, identity, gateway, database, or Paystack implementation.

# 7even Hospitality Pilot — Architecture Review and Acceptance Criteria

## Review gate

Do not begin the first hotel onboarding or accept live bookings until the developer and product owner review this architecture and explicitly agree on the acceptance criteria below. This pull request is for review; it is not approval to launch payments or claim live room availability.

## Current pilot boundary

- Initial location: Uyo, Akwa Ibom, Nigeria.
- Primary journey: a traveller arriving at Akwa Ibom Airport or a bus terminal finds suitable accommodation using arrival point, arrival time, budget, guests, check-in date and length of stay.
- Respect user intent first; optimize the decision second.
- Public discovery must only return real property records that meet the agreed publication/verification rules. A directory lead is not an onboarded hotel.
- Do not invent coordinates, driving time, prices, amenities, room availability, booking confirmation or partner consent.
- No live payment processing until Paystack test-mode end-to-end checks, webhook verification and refund checks pass.

## Developer review questions

1. Are the service boundaries between gateway, identity/auth and hospitality correct, and are authentication/authorization checks applied consistently?
2. Should public directory leads remain separate from verified/bookable `hospitality_properties`? Confirm the data model and import/update/deduplication strategy before expanding ingestion.
3. What exact evidence is required to mark a property, contact details, coordinates, rate, room inventory and availability as verified?
4. Which role may approve listings, coordinates, prices, rooms, reservations, payment reconciliation and refunds?
5. What are the expected idempotency, reservation-hold expiry, overlapping-booking, cancellation and refund invariants?
6. What is the operational source of truth for rates and inventory: partner-maintained records, a PMS/channel manager integration, or manually refreshed inventory with a freshness timestamp?
7. How should routing behave when OSRM is unavailable or origin coordinates are not confirmed?
8. What monitoring, audit trail, retention, privacy, backup/restore and incident procedures are required for the pilot?

## Acceptance criteria to agree before first onboarding

### A. Build and security

- `npm run test:hospitality`, `npm run build:web`, Node syntax checks and `git diff --check` pass in CI.
- Required JWT configuration fails closed; passwords are hashed; sessions/tokens expire and can be revoked; protected routes enforce role and ownership checks.
- No secrets, real guest data or payment credentials are committed.
- Migration runner can be safely rerun; schema changes are reviewed and documented.

### B. Hotel record quality and verification

- Each candidate has a stable deduplication key, source URL, capture timestamp, source confidence, and review status.
- A candidate directory entry is never implicitly converted into an active/verified property.
- Before publication, a human confirms the property exists and operates, partner authority/consent, direct contact route, full address, coordinates, room/resource types, current NGN rates, occupancy limits, policies and an explicit inventory freshness window.
- Coordinates are independently checked; routing output identifies itself as an estimate and is omitted when routing fails.
- Public results do not expose private partner/user data and do not claim availability unless the inventory contract supports it.

### C. Reservation lifecycle

- Tests cover successful creation, confirmation, overlapping inventory conflict, expired hold, cancellation, duplicate request replay and same idempotency key with a different payload.
- The reservation total is computed server-side from the agreed rate unit and number of nights.
- State changes are auditable; ownership/tenant boundaries are enforced.
- Cash-at-property is clearly labelled and cannot be confused with a paid online reservation.

### D. Payments and refunds

- Paystack test-mode initialization and server-side verification pass end-to-end.
- Invalid webhook signatures, failed transactions, duplicate/replayed webhooks, amount/currency mismatch and timeout paths are tested.
- Refund request and final reconciliation states are tested; cancellation cannot falsely mark a paid reservation refunded.
- Live keys remain disabled until the product owner approves the test evidence and operational checklist.

### E. Traveller experience

- Arrival screen works on mobile and communicates no-results / stale-inventory states honestly.
- Search respects the traveller's selected origin, budget, dates, guest count and stated need; no unsupported promise of a taxi, meal or room is made.
- Results are ranked transparently; user intent is preserved before optimization.
- Accessibility, error/loading states, privacy notice and support/escalation route are reviewed.

## Proposed build order after review

1. Agree architecture and criteria in this PR; resolve security/data-model blockers.
2. Establish a sourced Uyo discovery directory, deduplicate records, and keep all candidates unverified.
3. Select one willing hotel partner and complete a documented verification/onboarding checklist.
4. Validate address/coordinates, rate/room inventory and freshness with that partner.
5. Test booking lifecycle without live payment.
6. Configure OSRM and Paystack test mode; run end-to-end payment/webhook/refund tests.
7. Run a limited pilot only after sign-off.

## Known limitations at time of review

- The current database has no verified Uyo hotel inventory; empty discovery results are expected until properties are onboarded and approved.
- The current directory crawl captured 234 unique accommodation names from a source advertising 236 Uyo-area listings; the separate cross-source seed and normalized import currently produce 239 unique database leads. This is not a guarantee of every operating hotel in Uyo and not an endorsement. All records remain unverified.
- OSRM and Paystack credentials/configuration are environment-dependent; no live-payment readiness is claimed.
- Existing unit tests do not replace database-backed reservation lifecycle and Paystack end-to-end tests.
