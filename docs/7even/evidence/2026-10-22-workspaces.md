# Workspace and inventory verification

22 October 2026. Baseline: `16c199f`, including the existing main-branch migration that hides unverified hotel directory leads.

## Production finding

The initial read-only production checks returned healthy liveness and PostgreSQL readiness, zero published hotel offers at approved businesses, and an empty STAY offerings result. That establishes a responding configured database and missing approved/published inventory. It does not establish that the configured database is the client's intended project, or distinguish pending businesses from unpublished offers without staff access. No production rows were created, approved, seeded or changed.

The seven directory leads observed during the initial diagnosis were not bookable inventory. Main subsequently added migration 020 to hide unverified hotel leads. They are not a substitute for approved properties, published room types and current availability. See `../INVENTORY_READINESS_RUNBOOK.md` for the real onboarding and investigation path.

## Delivered behavior

- Business overview gives the next permitted task and explains persisted listing blockers. Pending businesses cannot add places or rewards. Existing team, venue, reception, demand, reward and payment workflows remain available within their existing permissions.
- A listing save keeps the original idempotent mutation, then reads current checks. Its pop-up shows before/after state and the next task. Failure of that read confirms the saved write and never suggests writing again.
- Admin has an unlisted `/admin/login` entry. Desktop and mobile public navigation omit admin and workspace links for admin accounts. Authentication, sessions, CSRF and role checks remain the existing implementation.
- Admin businesses, reservations, payments and audit records use bounded server search and pagination. Owners can search their full reservation history; the server derives the business from the session and rejects tenant overrides. Existing financial commands and reservation dialogs are preserved.
- Inventory checks distinguish connection response, approval, verification, publication, freshness, capacity, duplicate dates, search projection limits and location warnings. Counts cover all scoped records even when detail lists are bounded.
- Upcoming private inventory is filtered before the 500-window limit, so old dates cannot hide current availability. Historical unresolved payment exceptions are selected independently of the latest 200 payments.

This change adds no schema migration, dependency, role grant or money-moving command. The directory migration belongs to the existing baseline.

## Fresh local verification

- `npm test`: **272 passed, zero failed or skipped**.
- `npm run test:integration`: **200 passed, zero failed or skipped**, using isolated PostgreSQL databases and restricted runtime connections.
- `npm run build`: passed, including TypeScript checking. The existing bundle-size warning remains; the main minified bundle is above 500 kB.
- `npm run lint`: passed with existing warnings. All new implementation/test files are clean. The 16 warnings in modified existing files are the same non-null-assertion warnings reproduced from the baseline versions of those files. Unrelated warnings were not rewritten.
- Independent source reviews covered role checks before queries, literal bound search, tenant scope, stable pagination, read-after-write failure handling and unchanged financial commands. Concrete findings were fixed and regression-tested before release.

Database/HTTP regressions include registration through review and publication, stale/expired/sold-out inventory, duplicate hotel dates, the 501st-window edge, complete counts beyond detail caps, old payment exceptions, 208 owner reservations, an old guest outside overview's latest 200, and anonymous/customer/reception/admin/cross-owner denial where applicable.

Local browser checks covered desktop and 375px phone layouts, listing and availability editors, persisted draft-to-search-ready transitions, search/status/empty states, business review and refund-review dialogs without financial submission, private entry redirects, owner access denial, mobile focus wrapping and Escape, and keyboard/horizontal access to payment delivery/actions. Body width remained 375px while the wide table scrolled separately. Reduced motion produced no startup intro and a `0.00001s` control transition.

A controlled block of the post-save overview GET proved that a successful write remains a successful save when checks cannot refresh. The block and all viewport/media overrides were removed. The sample listing was restored to published. The disposable pending onboarding fixture was deleted; unrelated rows across ten affected tables retained their fingerprints.

## Design evidence

App Designer's Reception desk direction was selected from three rendered concepts. The existing forest, ivory, sand, charcoal and taupe identity and Manrope/Newsreader fonts were preserved. The same independent critic completed two rounds and a reservation-screen supplement: ten of twelve design criteria score 4/5, two score 3/5, Fidelity 4/5. This is a passed skill stop rule, not a claim of universal 5/5.

Actual 3× frames, scan JSON, before/after, signature and contact sheet are in `design/7even-workspaces`. Core final scans have no FAILs. Payment-table warnings are deliberate: compact operational headings and written semantic status colors. The CUA DOM scan is adapted from App Designer; the shell Playwright renderer, iOS checks and screenshot pixel-contrast pass were not run. Brand contrast ratios are forest/ivory 9.70, charcoal/ivory 16.09, taupe/ivory 4.74, sand/forest 6.81, warning/ivory 5.96 and danger/ivory 7.19.

## Release and recovery

Use the repository's existing main-to-Vercel deployment flow. GitHub CI and the deployment status must be checked on the pushed commit, followed by the existing read-only production smoke script and live staff-entry/public-navigation inspection. This document records local evidence; post-push results are reported separately. CI omits tests requiring a runtime database URL when that variable is not configured, so a green CI badge alone does not replace the complete local restricted-runtime run above.

Rollback is a revert of the single workspace change commit on main, followed by the normal push/deployment. Its APIs and UI use existing tables; no data rollback or down migration is required. Preserve migration 020 and all financial journals. Reverse-patch applicability is checked before committing. Deployment latency, a sub-five-minute infrastructure rollback, live provider behavior, production staff sessions and nationwide-scale performance are not established by these local checks. No paid service, notification workflow or rollout infrastructure was added.
