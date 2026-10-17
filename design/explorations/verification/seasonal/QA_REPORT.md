# Seasonal brand verification

16 October 2026. Local built app at http://127.0.0.1:7078. No production deployment, provider payment, benefit consumption or business mutation.

## Public-page inspector findings

Final inspector result: **8 FAIL, 5 WARN**, exit 1. This is not a clean design-audit pass. Preserve both the [initial raw report](../../../../.taste-skill/inspect/seasonal-home/report.json) and [final raw report](../../../../.taste-skill/inspect/seasonal-home-final/report.json), including the desktop, tablet and phone captures beside each report. The second run was justified by the changed campaign caption sizes. Node 24.21 and /usr/bin/google-chrome passed preflight.

The table reproduces report evidence and its proposed fix. It does not invent element selectors. FAIL findings precede WARN findings.

| Level | Page | Widths (px) | Exact inspector evidence / affected element | Smallest proposed fix from inspector |
|---|---|---|---|---|
| FAIL | / | 1440, 768, 390 | 7 eyebrow/kicker label(s) above headings: "Autumn edit" above "Rooms, tables and days out."; "Worth a look / 01" above "A little room for a good weekend."; "A place to stay" above "A quiet room above the city"; "At the table" above "A table worth taking your time at"; "Something to do" above "Clay, conversation and something to keep" | Delete them. If the label carried real information, fold it into the headline or the supporting sentence. |
| FAIL | / | 1440, 768 | Decorative index numbers: "07" | Remove them. If order truly matters, write it into the words ("First, …") or use a real <ol>. |
| FAIL | / | 1440, 768, 390 | 14 tiny uppercase letter-spaced labels (e.g. "Good places. Nigeria first.", "Your plan", "Where", "When"). | Use sentence-case text at a readable size, or delete the label. |
| FAIL | / | 1440, 768, 390 | 8 thin rule(s)/divider line(s): header.public-header 1440px \| form.landing-search 1328px \| div.offering-price 474px \| div.offering-price 373px | Delete. Separate with space, a tone change, or scale. Lines are only for real tables and form fields. |
| FAIL | / | 1440, 768, 390 | 22 text blocks under 13px. | Nothing meant to be read goes below 13px. |
| FAIL | / | 1440 | Only 2 element(s) moved while the page loaded and scrolled. | Build the motion layer (SKILL.md step 9, references/motion.md): the signature move, an entrance for the parts of every section, feedback on every control, and one moving picture. Transform and opacity only, with a reduced-motion fallback. |
| FAIL | / | 768 | 3 headline(s) wrap past two lines at 768px: "Rooms, tables and days out." → 4 lines (5 words, 80px); "A change of scene. Close to home." → 3 lines (7 words, 57.6px); "Good places. Worth your time." → 3 lines (5 words, 33.6px, a paragraph set above 32px) | Cut words first (a headline is a title, not a sentence). Then give it a wider measure. Lower the size only as a last resort and never below the scale you chose. A real statement paragraph belongs in a <p> or <blockquote> at 32px or less. |
| FAIL | / | 390 | 2 headline(s) wrap past two lines at 390px: "A change of scene. Close to home." → 3 lines (7 words, 56px); "Good places. Worth your time." → 3 lines (5 words, 30.4px, a paragraph set above 24px) | Cut words first (a headline is a title, not a sentence). Then give it a wider measure. Lower the size only as a last resort and never below the scale you chose. A real statement paragraph belongs in a <p> or <blockquote> at 24px or less. |
| WARN | / | 1440, 768, 390 | 2 headline(s) switch typeface or to italic mid-line (the "one italic serif word" move). | Set the whole headline in one face. Emphasis comes from the words. |
| WARN | / | 1440, 768, 390 | Yellow-cream background (page background #fffdf8, section #fffdf8, section #fcfaf3). | Use the drawn palette. If you want warmth, take a low-chroma stone or bone, not a yellow cream. |
| WARN | / | 1440, 768, 390 | 15 different font sizes (10, 11, 12, 13, 14, 16, 17, 18, 30, 34, 48, 65, 66, 69, 112). | A page needs about five: display, heading, lead, body, small. |
| WARN | / | 1440, 768, 390 | The running text is a soft grey on its ground (4.6:1). | Set body copy in the full ink (7:1 or more). Keep the muted ink for secondary notes; pages read thin and unfinished when everything is grey. |
| WARN | / | 1440 | No video anywhere on the page. | Look for one honest clip with scripts/assets.mjs --video (the place, the material, the process) and use it as a muted loop with a poster frame. Defend its absence only if no clip fits the subject. |

## Scope and visual assessment

The campaign label and hero photo credits were increased to 13px, sentence case, with wrapping at all widths. This reduces small text in the new campaign elements. Existing smaller labels, index numbers, divider treatment, multi-line titles and restrained motion remain listed above rather than hidden with an allow flag. The ivory and taupe are explicit client palette choices; the inspector's cream preference does not override them. No decorative video or new motion system was added for a seasonal palette change. These are retained design-review findings, not evidence that the calendar failed.

The saved final desktop fold and tablet/mobile full-page contact sheets were visually inspected. No overlap or clipped campaign content was observed. The tablet hero still uses four title lines and the lower mobile title uses three, as the report records. The first initial desktop fold missed a photo during load; the final fold and all four campaign browser checks show loaded images. Full screen-reader/device coverage is not claimed.

## Functional browser evidence

- seasons.json records all four expected accents and unchanged core values: forest #2B4A33, ivory #FFFDF8, sand #E1D6B8, charcoal #241F18 and taupe #7A7161. Main button computed color stays rgb(43,74,51). All four stock photographs loaded and their creator credits changed with the campaign. The spring, summer and winter desktop shots precede the final caption-size refinement; autumn-desktop.jpg and the final inspector captures show that refinement.
- rollover.json records an actual open-page transition from 2026-11-30T22:59:58.030Z to 23:00:00.113Z, Autumn to Winter at Lagos midnight. The URL stays unchanged; a browser timer performed the switch. A tab-scoped test clock was used and removed by reloading afterward. No production date override was added.
- resume.json records selecting Spring after a simulated clock jump and focus/resume event. Unit tests also cover page-resume scheduling and backward clock correction.
- responsive.json records 768px and 390px: no horizontal overflow, 13px campaign label/credit, touch-sized search button and fixed forest-green action. The final 1440px check also had no overflow.
- The mobile search form navigated to /explore?kind=STAY&city=Lagos and returned the real local catalog result.
- reception.json and reception-dialog.jpg record fixed forest-green active navigation/action/focus, ivory background, no overflow, opening the benefit dialog and Escape returning focus to Use a benefit. No benefit was submitted or consumed. The test clock was absent.
- Final browser console and all three final inspector viewport console lists were empty.

## Automated evidence

205 unit/contract/frontend tests and 43 PostgreSQL/API integration tests passed, zero failed or skipped. Build and typecheck pass. Lint exits 0 with 162 warnings and 4 informational diagnostics. The 52 new assertions cover month/quarter boundaries, leap years, New Year, host timezone independence, resumed tabs, cleanup, stable core tokens, contrast, campaign content and PWA metadata. Logs are preserved under docs/7even/evidence/seasonal-*.txt.

Relevant contrast: forest/ivory 9.70:1, charcoal/ivory 16.09:1, taupe/ivory 4.74:1. Sand is decorative; interactive control boundaries use taupe. The pure date logic and independent code review found no blocking feature defect. Existing provider, email and production-release evidence gaps remain outside this appearance-only change.

Frozen implementation: SHA-256 52b295b35261cacf93a9420ead0e16912e378a1856010908b66f9f740de758fe, 111 files, using the path/NUL/bytes/NUL algorithm documented in the original threat model. Documentation and saved renders are outside that digest.
