# Business workspaces and inventory checks

> 2026-10-22 · Explain empty listings, improve business and admin dashboards, and provide private admin access.

## In short

The dashboards explain listing blockers and direct businesses to their next step. Admins inspect inventory and historical records. An empty listings response is distinguished from a failed database query.

## What changed

- `services/platform/src/listingReadiness.ts`, `adminRecords.ts`, `app.ts` and `store.ts`: inventory diagnostics, guarded record searches, older payment exceptions and future inventory before the history limit.
- `packages/contracts/src/index.ts`: shared readiness, blocker, exception-summary and paginated-result types.
- Under `apps/web/src/pages/workspace/`, `BusinessPage.tsx`, `BusinessWorkspaceOverview.tsx`, `AdminPage.tsx`, `AdminWorkspaceOverview.tsx`, `AdminInventoryPage.tsx`, `AdminRecords.tsx`, `ListingReadiness.tsx` and `ListingUpdateReceipt.tsx`: operational screens, next steps, search controls, reservation visibility and save receipts. `shared.tsx` makes reservation tables keyboard-scrollable.
- `apps/web/src/lib/listingReadiness.ts`, `businessWorkspace.ts`, `workspaceNavigation.ts` and their `.test.ts` files: task selection, upcoming dates and safe login destinations.
- `apps/web/src/App.tsx`, `components/WorkspaceShell.tsx`, `pages/public/AuthPage.tsx` and `PublicShell.tsx`: workspace navigation and unlisted admin login using existing authentication.
- `apps/web/src/styles/workbench.css` and `main.tsx`: responsive branded layouts and stylesheet loading.
- `tests/integration/admin-records.test.ts`, `listing-readiness.test.ts` and `business-inventory-history.test.ts`: database and HTTP regressions. `design/7even-workspaces/` records design evidence; `docs/7even/INVENTORY_READINESS_RUNBOOK.md` explains investigation and recovery.

## How it works

1. Existing session and role checks identify the business owner or administrator. Knowing `/admin/login` grants no access.
2. `listingReadiness()` queries PostgreSQL and records its check time. It evaluates approval, publication, verification, dates, confirmation freshness and capacity.
3. Hotel eligibility also requires an unambiguous service date within the engine’s first 500 projected windows. Counts still include every inventory window. Returned detail lists have explicit limits and truncation flags.
4. `nextBusinessTask()` chooses an existing action. Verification problems lead to business details; draft listings lead to editing; stale availability leads to reconfirmation.
5. Owner and admin searches filter all matching records before pagination. Owner queries use the authenticated business and reject client tenant overrides. Older refunds load their reservation through the existing authorized endpoint before opening the existing dialog.
6. Listing saves refresh persisted checks for a before/after receipt. If that read fails, the confirmed save remains successful; the receipt directs review without repeating the write.

## Why it's built this way

Existing authentication, financial actions and projections remain the authority. Read-only diagnostics explain their results without relaxing booking rules. Filtering expired windows before the private projection limit prevents old history from hiding upcoming inventory. Directory leads remain separate from bookable offers.

## The concept worth knowing: eligibility

Think of a hotel showing its sign while every room is unavailable. Being published does not establish availability.

Here, eligibility means passing the default search checks at the recorded time. Requested dates and room counts still need their own checks. Likewise, a successful database query proves connectivity at that moment, not that inventory is ready.

## Watch out for

Final local verification passed 272 unit tests and 200 PostgreSQL integration tests, with none skipped. Production checks found zero published hotel offers at approved businesses; production inventory was not changed. Genuine partner onboarding and inventory remain necessary. Local browser and database tests do not prove production scale, live payments or a completed deployment.

## Check yourself

1. Why can a published room remain hidden?
   <details><summary>Answer</summary>Approval, verification, fresh capacity, conflicting windows or projection limits can still prevent eligibility.</details>

2. Why filter history before limiting windows?
   <details><summary>Answer</summary>Otherwise 500 expired rows can hide the next valid future window.</details>

3. Why search before pagination?
   <details><summary>Answer</summary>Searching only the displayed page would miss older matching records.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
