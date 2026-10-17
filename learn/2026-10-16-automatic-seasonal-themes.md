# Automatic seasonal campaigns with a fixed brand

2026-10-16 · Apply the supplied 7even colors and change campaign accents, copy and photography automatically.

## In short
The five core brand colors now stay fixed across the website and workspaces. Four calendar campaigns change automatically at Lagos midnight on 1 March, June, September and December, including while a page remains open.

## What changed
- `apps/web/src/lib/season.ts`: `seasonAt`, `nextSeasonStart` and `watchSeason` select and schedule the campaign. `context/SeasonContext.tsx` shares it with React; `main.tsx` applies the initial selector before mounting.
- `lib/seasonalCampaigns.ts` and `lib/editorialImages.ts`: separate campaign messages and credited image data from presentation. `pages/public/LandingPage.tsx` reads the selected campaign; `PublicShell.tsx` preserves existing image imports.
- `styles/global.css`, `public.css`, `customer.css` and `workspace.css`: fixed brand tokens, decorative seasonal accents and readable control boundaries. New campaign labels and photo credits use at least 13px text.
- `apps/web/index.html`, `public/manifest.webmanifest` and `public/sw.js`: ivory app metadata and a new shell-cache version.
- `tests/frontend/season.test.ts` and `brand-theme.test.ts`: 52 new tests for scheduling, cleanup, colors, contrast, content and metadata.
- `public/media/SOURCES.txt` records the campaign photography. `docs/7even/SEASONAL_THEMES.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_REVIEW.md` and `FILE_GUIDE.md` describe the feature. Saved logs, screenshots and `verification/seasonal/QA_REPORT.md` record actual verification.

## How it works
1. `seasonAt` reads the month using an explicit Gregorian calendar in `Africa/Lagos`. It does not inherit the visitor's timezone.
2. `SeasonProvider` supplies that season to the landing page. A layout effect commits its matching `data-season` attribute before painting.
3. CSS selects the campaign accent. React selects its message, image, alt text and credit. Core colors remain separate.
4. `watchSeason` keeps one timeout, scheduled for the next boundary or 60 seconds, whichever comes first. It only publishes a changed season.
5. Focus, a visible page and `pageshow` recheck the date immediately. Cleanup cancels the timer and removes listeners.

## Why it's built this way
A single selected season keeps content and colors together. Short bounded timers avoid the browser's limit on very long timeouts. Resume checks handle sleeping tabs. No stored preference, manual switch, server job or new credential is needed. Sand stays decorative because its contrast is too low for input boundaries; taupe supplies those boundaries.

## The concept worth knowing: rechecking derived state
Think of a shop changing its window display when it opens. It checks today's date instead of replaying every display missed while closed. Here the campaign is derived from the current clock. A resumed tab calculates the correct season directly, and stale scheduled callbacks cannot restart a stopped watcher.

## Watch out for
The device clock must be correct; this affects appearance only. These four names describe calendar campaigns, not Nigerian weather. Remote stock photos need connectivity. All 205 unit tests and 43 integration tests pass, and a browser timer visibly changed Autumn to Winter without navigation. Build passes; lint retains warnings. The public design inspector still reports eight FAIL and five WARN findings about the existing editorial treatment, documented in the QA report. A full assistive-technology/device audit was not performed.

## Check yourself
1. Why keep seasonal accents separate from the primary button color?
<details><summary>Answer</summary>Campaign changes should not change the identity or the meaning and contrast of operational controls.</details>

2. What happens if a tab sleeps through two seasons?
<details><summary>Answer</summary>Its resume check selects the current campaign directly. It does not replay the missed seasons.</details>

3. Why cancel both the timeout and resume listeners?
<details><summary>Answer</summary>Otherwise an unmounted provider could continue updating state or create duplicate timers after remounting.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
