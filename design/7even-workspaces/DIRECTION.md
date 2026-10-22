# 7even workspaces

22 October 2026. Business and administration workspace redesign.

## Brief

This brief is **self-authored from the user's existing instructions and the current codebase**. 7even is a Nigerian hospitality marketplace starting in Uyo. Hotels, lounges, dining venues and experience operators prepare inventory, accept reservations and operate a reception desk. The internal 7even team reviews businesses, investigates exceptions and monitors platform activity.

The business user's first ten seconds should answer: what prevents my place being bookable, and who needs attention today? The administrator's first ten seconds should answer: what requires review, and which parts of the service need investigation? The intended feeling is attentive, composed and exact. The outside-app concepts explored below are a reception desk, a departures board and a room key.

The user has already supplied the name, logo and palette. They requested a responsive web implementation, complete working dashboards, a private administrator entry point and a production push. No paid image generation is used. No name, logo or product capabilities are being changed to satisfy a design rubric.

## Scope adaptation

App Designer was explicitly requested. Its three-direction exploration, content-first design, meaningful motion and independent scored critique apply. This is a React web application, so iPhone device wrappers, Apple-only typography, Liquid Glass, native haptics, SwiftUI and App Store assets would misrepresent the product. The existing logo and icon are retained. The rubric's native-fluency line means **web task fluency** here: browser navigation, accessible forms, keyboard operation, responsive tables, focus management and clear state changes. No iOS-font or real-device verification is claimed.

The shell renderer is not run because the task's browser-control policy requires CUA. Node v24.21.0 and `/usr/bin/google-chrome` are available. The project does not resolve `playwright-core`; nothing is installed. Root will render the exploration and production screens with CUA, save the screenshots, scan the actual rendered DOM and appoint one critic. Scores are pending rendered evidence; a requested 5/5 is a target, not a result.

## Current app

Source inspected: `WorkspaceShell.tsx`, `BusinessPage.tsx`, `AdminPage.tsx`, `OperationsPage.tsx`, shared reservation UI and workspace/global style sheets. Existing workspaces have an ivory sidebar, quiet active links, serif page headlines, a metric strip, reservation tables and stacked panels. The visual risk is the app-designer **dashboard reflex**: measures precede the task, with operational readiness comparatively hard to locate. This is a source audit, not a completed screenshot scan. Before screenshots and exact scan findings must be added after browser inspection.

### Keep

- [x] Brand name, existing two-stroke 7 logo and installed icon.
- [x] Forest, ivory, sand, charcoal and taupe core identity.
- [x] All business destinations: overview, reservations, offerings, venues, demand, rewards, team, business details, reception and existing payment workflows.
- [x] Business approval status and publishing requirements.
- [x] Reservation actions, status filters, guest search, capacity and availability controls.
- [x] Existing staff permissions, tenant boundaries and server validation.
- [x] All admin destinations: overview, businesses, payments and settlement, operations, points policy and audit history.
- [x] Administrative review, payment exceptions, integration operations and audit information.
- [x] Connection indicator, accessible mobile navigation and sign out.
- [x] Currency, fee and settlement semantics. A payment notification is not bank settlement.
- [x] Error/success pop-ups, focus management and reduced-motion support.

### Lose

- Task-obscuring greetings and marketing-style page headings.
- Public discovery of the internal admin entry in public navigation. This is only a visibility change; server role checks must remain the security boundary.
- Equal visual weight for every metric and every section.
- An empty listing result that gives operators no way to distinguish inventory readiness from a database fault.

### Unknown until functional audit

- Production database reachability, approved inventory counts and freshness. Do not fabricate these values or loosen approval/freshness rules to manufacture results.
- Which locally available business fixtures represent a complete onboarding path.
- Whether absent information is a backend contract gap or simply hidden by the UI.

No feature is removed through this keep/lose list. Before/after screenshots and checked keep items belong to the verification record once implementation is complete.

## Research and references

Public source text retrieved on 22 October 2026:

1. [Mews operations](https://www.mews.com/en/products/operations). The page explicitly groups booking, pre-arrival, arrival/check-in, stay, check-out and back office. Reservation management promises a snapshot of who is coming and going by hour, day or month. This supports an arrival-first business view rather than a generic revenue hero. Page text was inspected; its rendered product visuals were not inspected by this agent.
2. [Cloudbeds PMS](https://www.cloudbeds.com/property-management-system/). The page describes a unified calendar, instant search and filters, reservation/housekeeping coordination, custom roles and connected reporting. It distinguishes the front-desk core from reporting. This supports linked operational queues and permission-specific workspaces. Text was inspected; visual layout claims remain provisional.
3. [Little Hotelier front desk](https://www.littlehotelier.com/features/front-desk/) and [RoomRaccoon PMS](https://www.roomraccoon.com/property-management-system/) returned HTTP 403. They were attempted, not inspected. A third current competitor visual study is incomplete. No invented competitor findings are used.

The three leading-product requirement is therefore **partially verified**. The shared category convention supported by the two available sources is an integrated operational workbench with reservations, inventory and reporting. The refused default is a greeting followed by a large earnings figure, a symmetrical grid of metric tiles and an undifferentiated recent list. We also refuse a navy or violet enterprise rebrand; the user's forest identity stays intact.

Outside-app concepts are design interpretations, not claimed field research: an attentive reception desk, a departures board showing the next exception and a tactile room key with one job.

### Ten-source catalog decisions

All ten installed catalog entries were considered. No new browser library or hosted design service is needed.

| Source | Decision |
|---|---|
| Superdesign | Use the local direction/context workflow; hosted generation is not called. |
| Better Design | Semantic roles and a state-change reveal. Inspected local `panel-reveal.tsx`; retain the reduced-motion principle, not its blur/80px travel or dependencies. |
| Design Taste | Use hierarchy, typography, accessible color and precise alignment. Existing brand outranks genre palette rules. |
| Canvas UI | GPU canvas adds no information to this operational task; omit. |
| Paper shaders | Material is expressed through flat brand surfaces; no shader runtime. |
| UI Layouts | Responsive composition informs a sidebar/content split, without copying a component. |
| Hyperiux | Effects are unnecessary for operations and are omitted. |
| Motion Primitives | Inspected disclosure source for controlled state and trigger/content separation; use existing native web components, no Motion dependency. |
| Cursify | A custom cursor would impair familiar interaction; omit. Source license is not established. |
| Trickle UI Kit | Inspected CSS-led and reduced-motion documentation. No decorative text animation in workspaces. |

## Three directions

`explore.html` contains three fully composed responsive versions of the same business core task. Every value is visibly labelled **Local design sample**, not production activity. The concepts intentionally change ground, type and richness. Their exploratory signal hues are not changes to the approved production palette.

| Direction | Concept | Source | Ground | Type | Signal | Richness |
|---|---|---|---|---|---|---|
| A. Reception desk | 7even is an attentive reception desk. | place | light | serif | green | colour-material |
| B. Departures board | 7even is a departures board for the next decision. | media | dark | condensed | orange | shape |
| C. Room key | 7even is the key that makes a place ready. | object | colour-field | rounded | neutral | 3d-object |

Direction A is the recommended candidate, pending rendered comparison. It uses the user's hospitality identity and makes readiness the central action, with arrivals directly below. Direction B's precision helps the admin exception queue but a dark control-room surface should not become the default hospitality interface. Direction C makes onboarding warm and memorable but its object takes too much space from a returning operator. Borrow B's compact, aligned exception rows into A; keep C as exploration only.

The history comparison is constrained by the existing brand. Against prior light/grotesque/blue/photography rows, A differs by type, hue and richness. Against the October 7 light/grotesque/teal/3d-object row, it differs by source, type, hue and richness. Against the October 8 place/light/grotesque/blue/illustration row, it differs by type, hue and richness. Current app source was light/serif/green/shape with no distinctive physical-world concept. The new production direction preserves palette and font contracts deliberately, so we do not pretend to satisfy a mechanical three-column change against the current app at the expense of its brand. The change is task hierarchy, material navigation, content density and state clarity.

## Recommended tokens and implementation guidance

| Role | Value / application |
|---|---|
| Primary | `#2B4A33`; primary actions, selected navigation, key operational emphasis. |
| Ground / raised | `#FFFDF8`; reading and forms. Use existing subtle tinted surface token for secondary work zones. |
| Rule | `#E1D6B8`; decorative dividers only. Input boundaries use the existing stronger taupe token. |
| Ink | `#241F18`; headings and body. |
| Secondary ink | `#7A7161`; helper text and labels, verified against actual background. |
| Success / warning / error | Existing `#28543A` / `#845A1F` / `#9C302C`, with written status, never color alone. |
| Inverse rail | Forest with ivory text. Selected item has a sand inset and ivory text on a lighter forest surface. Check contrast in browser. |
| Display | Existing Newsreader, fallback Georgia. Use 51.2px desktop / 40px phone task display, with 24px page and section headings, 1.08 leading, slight negative tracking. A reception-folio voice, used sparingly. |
| UI | Existing Manrope, fallback Arial. Preserved for familiar controls and cross-site continuity, examined rather than selected as a default. 16px body, 14px row metadata, 12px small labels. No meaningful text below 12px. |
| Data | Tabular numerals for amounts, times and counts. No new font download. |
| Space | Existing spacing scale, aligned to 4/8/12/16/24/32/48/64px. 32px content gutter desktop, 20px phone. |
| Radius | 8px controls, 16px singular task surface, pill only for small status labels. No nested rounded cards. |
| Hit area | At least 44px for controls and actionable rows, focus rings using forest on ivory. |
| Layout | 238px rail, minmax(0,1fr) body. Main task and action own the first viewport. Dense reservations/exception tables remain tables; on narrow screens preserve labels and intentional scrolling. |

Suggested implementation targets are existing `WorkspaceShell`, `BusinessPage`, `AdminPage` and their shared stylesheet. Add modest page-specific semantic classes; do not replace shared form, modal, feedback or reservation logic. Keep every destination and action reachable. Admin overview should lead with an actionable review/exception section and a readable service/inventory state, followed by business records and audit links. Do not imply an empty inventory is an outage without evidence.

## Content

Production wording is grounded in actual data and contracts. Page names: **Business overview**, **Reservations**, **Places and services**, **Demand**, **Rewards**, **Your team**, **Business details**, **Platform overview**, **Businesses**, **Payments and settlement**, **Operations**, **Points policy**, **Activity log**. Product navigation can retain existing wording where changing it would confuse users.

Business first-run, pending review: **Your business is awaiting review.** The action is **View business details**. Listing creation remains disabled until the existing approval gate passes. Approved businesses without offers receive **Add your first place or service**. A saved draft receives **Your next listing is still a draft**, with **Review listing**. Search-ready inventory receives **Ready for your next guest**, with explicit unfiltered-search scope and **Open reception**. Every count and state comes from persisted API data.

Admin overview: **Platform overview**, **Marketplace readiness**, **Unresolved exceptions**, **Business applications**, **Platform activity**, **Activity log**. Database responding, publication, search eligibility and payment delivery remain separate facts. Full-history records retain server search, status filters, paging, attributable actions and existing financial controls. Read-only inventory inspection links each business to its own checks.

Artifact data is explicitly local sample data. The pending **Uyo onboarding sample** was created in the guarded local development database, captured, then removed. Its unrelated-row fingerprints remained unchanged. No sample records were added to production.

## Signature interaction

**Readiness hand-off, implemented.** An operator follows a persisted listing task into the existing editor. The original idempotent write commits first. A separate read retrieves current listing checks. The success pop-up then shows the saved offering, before/after check states, remaining blockers and the next task. **View next step** deliberately closes the pop-up and returns to the current workspace guidance. Nothing is marked ready optimistically. A failed read still confirms the saved write and says to refresh checks without saving again. The existing dialog and reduced-motion behavior are retained; no native haptics or new entrance animation is claimed.

The live local sequence was **Draft → Meets search checks → Open reception**. The sample listing was restored to published after testing. A controlled local block of the overview GET proved the successful-save/failed-refresh distinction. The block was removed immediately and a reload confirmed the persisted published state.

## Evidence

- Three rendered directions: `shots/explore/`, selected Reception desk. Prototype render and research limitations remain above.
- Actual desktop and 375px phone screens: `shots/r2/`; `mockup.html`, `before-after.html`, `signature.html` and `sheet.html` provide galleries.
- Two independent critique rounds and a focused reservation-screen supplement in `CRITIQUE.md`. Round 2: ten of twelve lines at 4/5, two at 3/5, fidelity 4/5. No claim of all 5/5.
- The owner reservation register now searches the full business history through a server-derived tenant scope. Existing reservation actions remain unchanged. The desktop/phone empty register received a focused visual review; populated cross-business payment-table evidence and database assertions are separate.
- Core Round 2 business, admin and inventory DOM scans contain no FAILs. Dense payment tables intentionally retain a 24px title and semantic status hues; written statuses distinguish outcomes. The scanner adapts App Designer's DOM checks through CUA. Original shell Playwright renderer, native iOS checks and screenshot pixel-contrast jobs were not run.
- Brand foreground/background combinations are checked in rendered DOM. Existing Manrope/Newsreader are deliberate web brand fonts, not Apple-font verification. No dark theme or native-device claim.
- Pending screenshots predate the minor ClipboardList/Clock3 semantic correction. That small change is explicitly unscored. Two startup-overlay captures were rejected and replaced after checking both DOM detachment and browser paint.
- Local test, production diagnosis and release evidence are recorded separately from visual scores. Public inventory is never fabricated to make a screen look complete.

## Pending history row

Global history is outside this agent's allowed edit scope. On completion record: `| 2026-10-22 | 7even workspaces | place | light | serif | green | colour-material |`. This pending row must not be silently discarded.
