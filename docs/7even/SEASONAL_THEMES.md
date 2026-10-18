# Brand and automatic seasonal campaigns

16 October 2026. This records the client-supplied brand palette and the automatic calendar campaigns implemented after the original hospitality rebuild. The original implementation review and threat-model hash describe that earlier baseline; they are not a hash of this feature's working tree.

## Stable brand colors

| Token | Color | Exact value | Application |
|---|---|---|---|
| `--brand-primary` | Forest Green | `#2B4A33` | Main buttons, links, active navigation and brand emphasis |
| `--brand-secondary` | Warm Ivory | `#FFFDF8` | Main backgrounds, cards, forms, content surfaces and installed-app background |
| `--brand-tertiary` | Sand / Champagne | `#E1D6B8` | Decorative borders, dividers and quiet details |
| `--brand-text` | Deep Charcoal | `#241F18` | Headings and body text |
| `--brand-text-muted` | Warm Taupe | `#7A7161` | Supporting text and stronger interactive control boundaries |

Shared semantic tokens in `apps/web/src/styles/global.css` point to these values. Sand is used for decorative separation; form boundaries use taupe to retain sufficient contrast. Operational actions remain Forest Green throughout the year. Success, warning and error colors keep their established meanings. The logo artwork and typography remain unchanged.

## Proposed seasonal accents and schedule

These four colors are the proposed campaign tokens supplied for this feature. They are not described as previously official 7even brand colors.

| Campaign | Calendar dates in `Africa/Lagos` | Proposed accent | Hero photograph and credit |
|---|---|---|---|
| Spring edit | 1 March through 31 May | Sage `#8BAA8A` | Courtyard, Francesca Saraco / Unsplash |
| Summer edit | 1 June through 31 August | Terracotta `#C67B55` | Lagos coast, Ben Iwara / Unsplash |
| Autumn edit | 1 September through 30 November | Copper `#B77943` | Restaurant, Jason Leung / Unsplash |
| Winter edit | 1 December through the last day of February | Slate blue `#466C78` | Hotel room, Vojtech Bruzek / Unsplash |

The names identify editorial calendar campaigns. They do not describe Nigeria's climate or promise particular weather. Each campaign begins at midnight in Lagos. New Year stays in the Winter edit; leap-year February ends correctly. The visitor's selected device timezone does not change the launch-market calendar.

Only `--season-accent` changes in the four `:root[data-season="…"]` rules. Its decorative dot and subtle campaign tint accompany a small edit label. The landing page reads the same selected season to change the support paragraph, hero image, descriptive alt text, caption and photographer credit. Main headline, search, operational controls, inventory, prices and points rules keep their existing behavior. Photographs are the four existing licensed editorial assets, each explicitly captioned as illustrative stock. [Photography register](../../apps/web/public/media/SOURCES.txt) records their provenance; they are not evidence of bookable partner inventory.

## How automatic changes work

1. `apps/web/src/lib/season.ts` uses an explicit Gregorian `Intl.DateTimeFormat` calendar with `Africa/Lagos` and returns the campaign for the current month. The next campaign start is computed in that same timezone, independently of the browser or server's default timezone. The platform supports an explicit timezone through [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat).
2. `main.tsx` writes the initial `data-season` selector before mounting the app. `SeasonProvider` then supplies one season to the landing page and commits the matching CSS selector before painting, keeping content and appearance together.
3. One watcher keeps one scheduled timeout at a time. It schedules the earlier of the next campaign boundary or 60 seconds, with a minimum positive delay. It publishes a state change only when the season changes. This avoids a months-long timer and notices corrected device clocks. A browser can delay a timer in an inactive or busy tab, so a scheduled timeout is not an exact execution guarantee. [setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout) describes these limitations.
4. Focus, `pageshow` and a return to visible document state immediately recheck the calendar. An open tab that was asleep selects the current campaign rather than replaying skipped campaigns.
5. Provider unmount cleanup cancels the timer and removes listeners. Unit coverage includes a React StrictMode-style setup, teardown and remount. This follows [React's effect setup and cleanup model](https://react.dev/reference/react/useEffect).

No cron job, paid service, new environment credential, database migration or administrator action is needed for this feature. It uses the device's current clock, not authenticated server time. An incorrect device date can therefore choose the wrong campaign until the clock is corrected; this affects appearance and editorial content only. Financial rules and booking authority remain server-side. Loading the remote editorial photography still requires connectivity.

## Verification and limits

The [local combined unit run](evidence/seasonal-unit.txt) contains 205 passing unit/contract/frontend tests, and the [integration run](evidence/seasonal-integration.txt) contains 43 passing tests. The [production build](evidence/seasonal-build.txt) includes TypeScript checking; [lint output](evidence/seasonal-lint.txt) retains its stated warnings rather than implying a warning-free run. The new assertions cover every month, all four Lagos midnight boundaries, leap year, New Year, host-timezone independence, invalid dates, open-page rollover, bounded scheduling, sleep/resume, backward clock correction, late callbacks, cleanup and StrictMode-style remount. Brand assertions check all five exact values, semantic aliases, four isolated campaign accents, relevant text/control contrast, distinct campaign copy, stock credits and fixed installed-app metadata.

Four real-browser desktop captures are saved in [the seasonal verification directory](../../design/explorations/verification/seasonal/). They show each campaign with loaded photography while core colors remain fixed. The [browser QA report](../../design/explorations/verification/seasonal/QA_REPORT.md) records viewport checks, an already-open page changing from Autumn to Winter without navigation, and a resume check selecting Spring. A complete browser/device and screen-reader matrix is not implied.

The initial and final public-page design inspector runs each reported eight FAIL and five WARN findings, mainly existing layout prescriptions and its own color preferences, including a preference conflicting with the supplied ivory. This is not a clean inspector pass. Raw data is retained in `.taste-skill/inspect/seasonal-home/report.json` and `.taste-skill/inspect/seasonal-home-final/report.json`; assessed findings, selected fixes and the actual browser evidence are described in the accompanying seasonal QA report. Earlier financial-provider, email and production-release limitations remain unchanged.
