# 7even Google Maps Proof of Concept — Readiness Gate

## Scope

Build one frontend-only, scroll-driven discovery scene for 7even āprən. Preserve the existing forest green, ivory, sand and ink brand tokens from `apps/web/src/styles/global.css`. Google Maps is a real geographic layer, not a static image, scraped tile layer or imitation map. The virtual pilot animation must be original and decorative; it must not imply availability, booking, payment, or operational progress.

This proof of concept must not change API routes, database/schema, hotel verification, inventory, authentication, checkout, payment/refund behavior, or production settings.

## Required configuration

1. Create or select a Google Cloud project owned by the organization.
2. Enable billing as required by Google Maps Platform.
3. Enable only the Google Maps Platform APIs actually used by the chosen implementation (initially Maps JavaScript API; add other APIs only after review).
4. Create a browser key restricted by HTTP referrer to the intended local and approved preview/production origins. Restrict the key to the enabled APIs. Do not use an unrestricted key.
5. Add the key through the relevant local/Vercel environment settings as `VITE_GOOGLE_MAPS_API_KEY`. A Maps JavaScript browser key is visible to browsers by design; its protection is referrer/API restriction, quota monitoring and not committing a real key. Never put a server credential or unrestricted key in a `VITE_*` variable.
6. Keep the real key out of source control, screenshots, logs, PR text and test fixtures. The repository template may contain only an empty value.

Do not enable the scene in a deployment until the key is restricted and its authorized origins have been verified.

## Location data gate

- Use only property coordinates whose verification evidence has been reviewed and approved under the existing hospitality verification workflow.
- A hotel name, address, directory lead, city centroid, geocoder guess or sample record is not evidence of verified property coordinates.
- Never place a marker for a property whose coordinates are missing, unverified, stale or associated with a different property.
- Until a real property's coordinates are verified, the map may be tested without property markers; it must clearly explain that verified locations are not yet available. Do not fabricate pins or imply that the absence of markers means no hotels exist.
- Do not request geolocation permission from a visitor for this proof of concept.

## Frontend acceptance criteria

- One scroll scene only; scroll position changes presentation, never triggers API mutations, reservations, payments or refunds.
- Use the existing brand CSS variables; no replacement palette.
- Respect `prefers-reduced-motion`; use a static, stable layout and disable scroll-linked motion when reduced motion is requested.
- If the Maps script fails, the key is missing, or WebGL is unavailable, show an accessible branded fallback without blocking search or navigation.
- Keyboard users can reach and understand any interactive controls; decorative pilot elements are hidden from assistive technology.
- Responsive behavior works at narrow mobile widths without horizontal overflow.
- Lazy-load the map when the scene approaches the viewport and avoid adding a heavyweight animation/3D dependency until the small proof of concept demonstrates the need.
- Do not add property/room immersion or booking-success animation until real search/property data and the existing checkout lifecycle have been verified.

## Validation evidence required before calling it complete

- Restricted-key configuration and authorized origin list reviewed (never record the key itself).
- Coordinate evidence reference and verification status for every displayed property marker.
- Production build and relevant automated tests pass.
- Browser checks on desktop and a real mobile viewport, including keyboard navigation, map-load failure, reduced motion, and no horizontal overflow.
- Confirm the scene does not alter URL search parameters, booking state, or any checkout/payment behavior.

## Current known blockers

- No Google Maps integration or `VITE_GOOGLE_MAPS_API_KEY` reference was found in the current source search.
- No approved property-coordinate field was found on the current public `Offering` frontend contract during the initial source search. The hospitality verification workflow does include coordinate evidence, but this document does not assume the approved coordinates are exposed to public discovery.
- The local remote desktop test device was reported offline during the initial audit, so browser-level acceptance checks remain outstanding.

These are explicit readiness gates, not reasons to invent credentials, coordinates, or test results.
