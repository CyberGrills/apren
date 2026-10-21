# One 7, two entrance strokes

2026-10-21 · Correct the 7even wordmark and add its startup animation.

## In short

The large striped 7 now replaces the small numeral in the wordmark, leaving the mark followed by EVEN. At startup, the first stripe appears, then the second, before the page is revealed. The animation uses the existing brand colors and skips itself when reduced motion is preferred.

## What changed

- `apps/web/src/components/Brand.tsx`: replaced the embedded raster lockup with vector paths for the two-stripe mark and EVEN, retaining the caption, compact variant and accessible name.
- `apps/web/src/styles/global.css`: gives the vector logo its normal and inverse colors through `currentColor` and styles the caption.
- `apps/web/src/components/BrandIntro.tsx`: owns the short-lived decorative overlay and its cleanup.
- `apps/web/src/styles/brand-intro.css`: defines the stripe entrances, fade, sizing and reduced-motion behavior.
- `apps/web/src/main.tsx`: mounts the intro beside the app once per document load.
- `design/explorations/verification/logo/`: stores responsive screenshots, browser observations and the verification record.
- `docs/7even/BRANCH_REVIEW_2026-10-21.md`: records the fetched branch inventory and distinguishes missing work from changes already included in main.

## How it works

1. The entrypoint mounts the app and intro as siblings.
2. The intro checks the browser's reduced-motion preference before rendering.
3. CSS animates stripe one for 300 ms. Stripe two starts at 320 ms. The overlay fades from 800 to 980 ms.
4. The overlay's own animation-end event removes it. Child animation events are ignored. A 1,100 ms timer provides a fallback.
5. Pointer or keyboard input dismisses it immediately. Changing to reduced motion also dismisses it. Cleanup removes every timer and listener.
6. Route changes leave the entrypoint mounted, so ordinary navigation does not replay the intro.

## Why it's built this way

Separate SVG paths let each stripe move independently while keeping the mark sharp at different sizes. Native CSS is enough for two short entrances. A shared Brand component keeps the public pages and workspace consistent without changing every caller.

## The concept worth knowing

Think of the intro as a theatre curtain beside the stage. Removing the curtain should not rebuild the stage. In React, its visibility state belongs to a separate sibling component, so dismissing it leaves the app and navigation mounted. `pointer-events: none` also lets input reach the page underneath.

## Watch out for

The caption remains small at header sizes. Future logo changes must preserve the two separate stroke classes. Reduced motion, timer cleanup and early input need checking whenever the intro changes. This task passed 242 existing automated tests, typecheck, build and focused browser checks at 390, 768 and 1280 px. It did not run provider or production database tests. The branch review is a source comparison, not a deployment check.

## Check yourself

1. Why mount the intro beside the app instead of inside each page?
   <details><summary>Answer</summary>Page mounts would replay it during navigation. The entrypoint remains mounted while routes change.</details>
2. What if a child stripe finishes its animation first?
   <details><summary>Answer</summary>Its event bubbles, but the handler checks the event target and fade animation name before removing the overlay.</details>
3. Why keep a timer if the fade already removes the intro?
   <details><summary>Answer</summary>It bounds the overlay's lifetime if the animation event never arrives. Cleanup prevents a stale timer after dismissal.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
