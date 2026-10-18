# Public and customer verification

16 October 2026. Local development at `http://127.0.0.1:5177`.

## Delivered surfaces

The public pages export `LandingPage`, `ExplorePage`, `OfferingPage`, `AuthPage` and `BusinessApplicationPage`. Customer pages export `AccountPage`, `TestCheckoutPage` and `PaymentReturnPage`. Account tabs cover bookings, points, benefits, exchange, updates and profile. These pages use the shared session, API client, UI components and exact backend contracts.

The Journal direction is implemented in React and responsive CSS. The unchanged supplied logo is used through the shared Brand component. Original conceptual alternatives remain in the parent exploration directory. The static concept board itself was authored but was not rendered; the implemented Journal app was rendered and reviewed in Chrome.

## Browser evidence

The actual local UI was used for the following connected journey. No direct database changes or substitute API calls were used to produce these customer outcomes.

1. Browse the landing page, filter offerings, open a stay and request a server quote for 16 to 17 October. The corrected breakdown showed ₦85,000 service, ₦6,375 tax and ₦91,375 total.
2. Hold the stay and complete the explicitly labelled local mock checkout. Reservation `7E-F431EFC9` became confirmed and its payment became paid. Bank settlement remained a separate unsettled state.
3. Another team member performed reception check-in and completion. The customer booking showed each resulting state, ending fulfilled.
4. The guest account showed a separate 850-point completed-visit entry alongside the clearly labelled 1,000-point development seed. The available balance was 1,850.
5. Claim Breakfast for two for 100 points, reducing the available balance to 1,750. The benefit became available and the reward's remaining capacity decreased from 50 to 49.
6. Offer the benefit as a gift to the second local fixture account. The original benefit became locked. Sign out and sign in as that recipient, whose booking list did not contain the sender's stay.
7. Accept the incoming gift. The recipient's benefit became available. Its private details showed the benefit reference, current version and redemption code.
8. After explicit human approval, another team member consumed this local sample through reception. The recipient's benefit then showed consumed. Its show-code and give/swap controls were absent. The private code is intentionally omitted from this report and screenshots.
9. Updates showed the gift invitation and benefit use. Marking the invitation read changed its state to read through the actual notification API.

After a fresh page reload, the recipient still saw the consumed state. No new console errors were captured after that reload. A prior development-only SessionProvider hot-update error exists in historical logs and is excluded from this narrower claim.

## Visual and accessibility review

Desktop and mobile landing pages, booking/payment screens, benefits, exchange and updates were inspected in the real browser. All five landing images were loaded. At a configured 390-pixel viewport the measured document width was 375, with no horizontal overflow. The six account navigation entries fit their 335-pixel container exactly.

Changes made during review included moving mobile search above the hero photograph, tightening the mobile account heading, stronger input boundaries, semantic category/gallery fieldsets, visible form labels and current-benefit version details. Text contrast calculations for the reviewed tokens were body 16.58:1, muted 5.42:1, accent 8.75:1 and white on the action color 9.75:1. The reduced-motion preference is handled by shared CSS. These checks do not substitute for a complete assistive-technology audit.

Saved screenshots contain JPEG bytes and have matching `.jpg` extensions:

- `landing-desktop.jpg`
- `landing-mobile.jpg`
- `customer-mock-confirmed-desktop.jpg`
- `customer-updates-mobile.jpg`
- `customer-gift-consumed-mobile.jpg`

## Focused command evidence

- TypeScript checking passed after the customer updates and pagination changes.
- Biome lint passed for the 19 owned public/customer source files.
- `node --test --test-isolation=none --test-reporter=spec apps/web/src/pages/customer/checkout.test.ts`: 3 tests passed, 0 failed. Cases cover internal mock routing, rejected untrusted or malformed destinations, and the exact approved live checkout origin.
- The subsequent Vite production build passed: 1,832 modules, JavaScript 371.15 kB / 108.68 kB gzip, CSS 54.11 kB / 10.36 kB gzip. Other team members continued editing shared files afterward, so the root integration check is the final repository-wide result.

## Review findings sent to the root implementer

The bounded read-only shared-UI review identified an IndexedDB read/modify/write race that could overwrite newly queued reception events while a sync request was in flight. The root implementer confirmed it and is replacing queue writes with atomic transactions. Mobile workspace navigation also needs its own close control and Escape handling; busy workspace modals need matching close guards; reception checkout should use the shared destination validator. These findings were reported with exact source locations. No root-owned implementation was changed by this agent.

The gift and benefit-use notifications currently point to bookings rather than exchange and benefits. This is a small server-generated navigation issue, already reported for integration.

## Limits

The payment exercised here is a local mock. It is not a Flutterwave sandbox test, provider settlement, bank reconciliation or real-money test. A browser offline check did not pass reliably in the other team member's session, so no browser-offline success is claimed. Queue unit and backend tests are separate evidence owned by the root team.

Photography provenance for the four selected editorial/fallback images is in `apps/web/public/media/SOURCES.txt`. The additional seeded listing images need their own complete provenance before production use. Dribbble and Behance references informed composition and operational density; their artwork was not copied. No hosted design generation, project upload, paid dependency or production deployment was performed.

The root agent owns the consolidated Edirae Learn breakdown and final repository-wide review. This report describes this agent's actual implementation and verification, and does not claim production financial readiness or perfection.
