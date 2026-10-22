# Finding a place by state, city and date

> 2026-10-22 · Improve Nigerian destination search and the landing-page calendar.

## In short
7even now suggests Nigerian destinations as someone types and offers state-first city selection on Explore. A shared calendar makes dates easier to choose, and the requested booking-principles section has been removed.

## What changed
- `packages/contracts/src/nigeriaLocations.ts`, `apps/web/public/data/nigeria/`, and `scripts/build-nigeria-locations.mjs`: licensed GeoNames records, canonical states, aliases, search ranking, provenance and a refresh script.
- `packages/contracts/src/index.ts`: optional state fields for business applications and offerings.
- `services/platform/src/locations.ts`, `app.ts`, `store.ts`, and `seed.ts`: destination suggestions, location metadata, search filtering, projections and guarded sample updates.
- `apps/web/src/components/LocationFields.tsx` and `location-fields.css`: destination suggestions and dependent state/city menus.
- `apps/web/src/components/DatePicker.tsx`, `lib/datePicker.ts`, and `styles/date-picker.css`: calendar controls, date arithmetic, range checks and responsive styling.
- `apps/web/src/pages/public/LandingPage.tsx` and `ExplorePage.tsx`: connect search controls, preserve query filters and remove the requested section.
- `apps/web/src/pages/public/BusinessApplicationPage.tsx` and `pages/workspace/BusinessPage.tsx`: collect state when creating or editing locations.
- `apps/web/src/lib/datePicker.test.ts`, `packages/contracts/test/nigeriaLocations.test.ts`, and `tests/integration/location-{metadata,search}.test.ts`: date, coverage and API regressions.
- `apps/web/public/media/SOURCES.txt` and `vercel.json`: attribution and function data packaging.

## How it works
1. Typing in Where requests `/api/locations`. Search uses names, aliases and state context; Uyo leads the initial suggestions.
2. Selecting a suggestion sends its city and state to Explore. Selecting another state loads that state's city file and clears the old city.
3. The API matches both state and city for scoped searches. Older city-only links retain their previous matching behavior.
4. Business and offering state is saved in existing `details.state` metadata. Changing an offering's city or venue without supplying state clears stale classification.
5. The calendar keeps dates as `YYYY-MM-DD`. It disables past days using Lagos time, supports keyboard navigation and returns focus when closed. Incomplete stay ranges trigger the existing feedback pop-up.

## Why it's built this way
- Existing JSON metadata avoids a production schema change. Unknown legacy states stay unknown rather than being guessed from a town name.
- Per-state files avoid downloading the national catalogue just to populate one select menu. The server caches the catalogue for suggestions.
- A native dialog provides focus containment and Escape handling without another dependency.

## The concept worth knowing: a name is not an identity
**Simply put:** two people can share a name. Nigerian places can too.

**More precisely:** source records keep stable GeoNames IDs, while hotel searches use the selected state together with the stored city name. The catalogue contains Abuja in both Borno and the FCT, so a city-only backfill could assign a hotel to the wrong state.

## Watch out for
- Existing listings need an owner-supplied state before appearing in state-scoped results.
- GeoNames coverage varies. Unresolved and historical records are excluded; it cannot guarantee every village or current boundary.
- Test keyboard selection, changing state, clearing dates, small screens and direct search links when changing these controls.

## Check yourself
1. Why must changing a state clear the selected city?
   <details><summary>Answer</summary>The previous city belongs to the previous state. Keeping it could submit an invalid pair and hide relevant listings.</details>
2. Why preserve city-only search links?
   <details><summary>Answer</summary>Existing links and assistant-generated searches may not include state. They should keep working while new searches can be more precise.</details>
3. What if a provider listing says Abuja but has no state?
   <details><summary>Answer</summary>It stays unclassified until its owner supplies state. Guessing FCT could misclassify a place in Borno.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---
*Made with Edirae Learn · edirae.com*
