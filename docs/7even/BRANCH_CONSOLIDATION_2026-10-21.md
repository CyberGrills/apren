# Consolidated branch review

2026-10-21. Integration branch: `merge/open-feature-branches-20261021`. Base: `origin/main` at `f4492b9b653a3a705adbfbbd1119b65e53d55348`.

## Outcome

All 30 remote branch tips outside main in the fetched snapshot are ancestors of the integration branch. The deleted `feat/remote-dev-control-plane` remote was pruned and was not recreated. Main has not been updated by this task. The combined result is ready for qualified review before the production-connected main branch changes.

- 15 branch tips were already ancestors of main.
- Nine equivalent/superseded branches and two retired Apren branches were reconciled with an ancestry-only merge. This retains their history and main's current code.
- The logo, concierge, database-policy and older deployment branches were integrated normally, with the resolutions below.

The baseline and previous branch descriptions remain in `BRANCH_REVIEW_2026-10-21.md`. The exact fetched tips and dispositions are listed below.

## Resolutions and corrections

1. Retained the corrected logo and its two-stroke, reduced-motion-aware startup sequence.
2. Integrated the concierge through the existing search API and hotel engine. Its clarification and error states use feedback pop-ups. The form has a visible label, OpenAI request disclosure and a responsive layout.
3. Require both server-only `OPENAI_API_KEY` and an explicit `OPENAI_MODEL`. No model is guessed. Strict output validation, missing-date clarification and exact Naira-to-kobo conversion remain on the server. Normal filters remain usable without provider credentials.
4. Added HTTP tests for preview write rejection and real restricted-role PostgreSQL tests for the concierge route and shared rate limit. Twenty-one concurrent requests across two app instances yield 20 successes and one rate-limit rejection.
5. Merged migrations 012/013 for internal-table RLS and grant-matched server-role policies. These preserve the existing server/API boundary; they do not provide tenant-by-tenant row isolation. Application authorization remains necessary.
6. Kept current `api/[...path].ts`, `db.ts`, `tsconfig.json` and `vercel.json` when resolving five conflicts from the older deployment branch. Their final content matches the main baseline. Added the six-function search-path migration as `014_function_search_path.sql`. Existing 010/011 contents and checksums are unchanged. The new statements are idempotent if an environment previously applied the older function script.
7. Removed an unsupported ARIA label from the booking-score wrapper. Its visible score and supporting text remain accessible, and the full lint command now exits successfully.

The separately privileged SQL operation in `database/operations/` was not executed. It changes Supabase's exposed-schema override and grants and requires project-specific administrative review.

## Fresh verification

| Check | Result |
| --- | --- |
| `npm test` | 242 passed, 0 failed, 0 skipped |
| `npm run test:integration` | 188 passed, 0 failed, 0 skipped; disposable local PostgreSQL with a restricted runtime login |
| `npm run build` | TypeScript check and Vite production build passed |
| `npm run lint` | Exit 0; 216 warnings and 8 informational diagnostics remain |
| `npm audit --omit=dev --json` | 0 known production dependency vulnerabilities reported |
| Trivy secret scan | 0 findings in scanned source; private env files, local data, Git internals, dependencies and built assets excluded |
| Branch ancestry | All 30 fetched tips included |
| Retained files | Existing migrations 010/011 and current API/deployment configuration match the baseline |
| Retired paths | No tracked `services/apren-engine` or `tests/engine` files restored |
| Browser | 1280, 768 and 390 px; visible form labels, no horizontal overflow, missing-config pop-up, Escape dismissal and working standard search |
| Final browser console query | No warning/error entries |

Screenshots and measured phone/tablet bounds are in `design/explorations/verification/consolidation/`. An initial local browser failure came from the development watcher encountering temporary merge-conflict syntax. Restarting the resolved entrypoint restored the local API; no production service was changed.

Tests use provider doubles and synthetic RPC evidence. Live OpenAI/model access, payment provider sandboxes, SMTP delivery, bank credit and Base wallet delivery were not exercised. The existing CI configuration supplies the test administrator URL only; the complete restricted-runtime evidence above comes from the local suite with both test URL keys configured. No dedicated static/API security scanner, hosted Data API inspection, backup/restore drill or production migration was performed. Passing these checks does not establish production readiness.

## Final release gate

GitHub records main's current Vercel deployment under `Production`. At inspection, open PRs #11, #33 and #36 had no human reviews. The user-provided AGENTS instructions require qualified human review before production release of authorization boundaries, tenant isolation, sensitive data flows and consequential migrations. That review remains required for the combined changes.

Automatic approval review also rejected a proposed partial main update because it would have deployed only part of the requested consolidation. That action did not run. The complete integration is therefore published for review rather than applying a partial production update or bypassing the review gate.

Application rollback must use a reviewed compatible artifact. Applied migration files remain immutable; any database correction must be reviewed and forward-only. Do not drop production schemas, rewrite migration checksums, delete journals or blindly retry external financial effects.

## Fetched branch ledger

| Branch | Fetched tip | Disposition |
| --- | --- | --- |
| `origin/ci/postgres-integration-tests` | `a078bd6daa437b1128cbbcc407b271e6af039263` | Already an ancestor of main |
| `origin/cleanup/7even-only-main-20261019` | `1e1bfffa9f1fddd7b01f765153e87425e95e67a7` | Already an ancestor of main |
| `origin/cleanup/7even-security-scope-wording-20261019` | `bde30d7736f63a0a8a89a5bb35979f58d89a7390` | Already an ancestor of main |
| `origin/cleanup/remove-stale-unit-log-20261019` | `00a5fa004bde9e199737906bee50134e549c691c` | Already an ancestor of main |
| `origin/feat/7even-bounded-hotel-search` | `9d8ac1baf592beec3682c4d3ddbe0be0ce747c65` | Equivalent/superseded; ancestry recorded |
| `origin/feat/7even-bulk-offering-projections` | `9384dcf2dd19048cb4f0e0336184735bdfc99e68` | Equivalent/superseded; ancestry recorded |
| `origin/feat/7even-hospitality-rebuild` | `73d3fd5935fa2a3a84c3c5b458273c3ac2573eda` | Already an ancestor of main |
| `origin/feat/7even-openai-hotel-concierge` | `da5572514fc08a76be0e2a5d193cc178661c9064` | Integrated with focused resolution |
| `origin/feat/logo-wordmark-intro` | `ce41ca22f08ba1c846bc2ef57a57b4746d5b9216` | Integrated with focused resolution |
| `origin/feat/multi-provider-payments` | `7b78bcdf1a9841fb96650f2d018aae996505e67c` | Already an ancestor of main |
| `origin/fix/7even-api-routing-and-postgres-tls-20261020` | `7decabcb3bb619ee808d56d8a2491581846e0bf7` | Already an ancestor of main |
| `origin/fix/7even-bounded-keyset-ranking` | `ad94faeeb6d46042590c695a6a1e5aad41e4f59f` | Equivalent/superseded; ancestry recorded |
| `origin/fix/7even-db-session-routing-20261020` | `186b6ca919ba73827a795ef57f68c606509abdab` | Equivalent/superseded; ancestry recorded |
| `origin/fix/7even-pwa-booking-start` | `9ff622f6de85ba10c48edd6d80a4cbb70bfc4871` | Already an ancestor of main |
| `origin/fix/7even-remove-external-hotel-directory-20261020` | `7fc3bbb1d9d39b605755bdcd7e6357e7dcf8a070` | Equivalent/superseded; ancestry recorded |
| `origin/fix/7even-scalable-hotel-candidate-retrieval` | `e1bbb31899902dcd0c5c05a629c0e063e23225c1` | Equivalent/superseded; ancestry recorded |
| `origin/fix/7even-set-based-inventory-eligibility` | `62accc2feb13ff2336972710d36a99882a9dda9b` | Equivalent/superseded; ancestry recorded |
| `origin/fix/7even-vercel-api-origin-20261020` | `d35017c1ec3ca73d0d63bb911426a74419c477dd` | Already an ancestor of main |
| `origin/fix/7even-vercel-workspace-bundling-20261020` | `2007cd7fe2866fc83655c4a7fac22367807e79df` | Already an ancestor of main |
| `origin/fix/apren-engine-route-registration-20261019` | `4083701c6f76f626aa25e7922f74cd098b93afc2` | Retired runtime; ancestry recorded |
| `origin/fix/apren-simulated-action-safety-20261019` | `fa285526ce1669a70076d6a0478437f7c85b94e6` | Retired runtime; ancestry recorded |
| `origin/fix/preserved-dependency-review` | `bd7692a5ef1fb8b98c0ed4fc3f7e9b577eb22165` | Already an ancestor of main |
| `origin/fix/production-api-startup-without-payment-keys-20261020` | `a82b3b19361d3e01fd71f10e8e2c016d7a8b8b91` | Already an ancestor of main |
| `origin/fix/vercel-supabase-api-20261018` | `2dd3222b19f1367a313b833a4c46e633db165698` | Integrated with focused resolution |
| `origin/merge/multi-provider-payments-main` | `c15912c20935060cdb371ac66db47f37439e43bd` | Already an ancestor of main |
| `origin/reconcile/final-20261018` | `796e2bd5ae352a54ea3bab79d11902bea3766797` | Already an ancestor of main |
| `origin/refactor/7even-hotel-booking-engine-20261019` | `5971b07e7acf65a211bf41d0a68b3da351e566d6` | Already an ancestor of main |
| `origin/security/lock-down-seven-data-api` | `4488f44d6ea12908875712063b344743600cf875` | Integrated with focused resolution |
| `origin/test/hotel-inventory-readiness` | `487f5067c00496a481fea36ac1e93afa043001cb` | Equivalent/superseded; ancestry recorded |
| `origin/validation/7even-bounded-keyset-ranking` | `6f2b0cbbdad9b4f02bda6cc7b6ecb6d7620867b4` | Equivalent/superseded; ancestry recorded |
