# Branch review: 7even

Reviewed on 2026-10-21 against fetched `origin/main` at `f4492b9b653a3a705adbfbbd1119b65e53d55348`. This is a Git/source comparison, not a fresh runtime or production-readiness test. The new logo branch was still being implemented while this snapshot was recorded.

## Findings and decisions

The fetched repository has **31 remote refs including main**, plus **5 local branches**. The symbolic `origin/HEAD` alias is excluded. Of the 30 remote branches outside main:

- **24 already contribute their changes to main, have equivalent code there, or are superseded by main.** There is no reason to merge them again.
- **3 belong to the retired Apren runtime or its old build/control workflow.** Keep them only for history; they are not active 7even work.
- **3 retain something worth deciding:** database/API hardening, the optional hotel concierge, and one trigger-function migration from an otherwise superseded Vercel branch.

No branch was merged, deleted, cherry-picked or reset for this review. Existing names and original tips are preserved below. An ancestor branch can still contain useful code: its status means that code is already in main, not that the feature itself is unnecessary.

### Work still worth reviewing

1. **`origin/security/lock-down-seven-data-api`: relevant hardening.** Review and test its two migrations with the real deployment roles, then review its separately privileged Supabase-admin operation. It enables RLS for internal tables and preserves existing `seven_app`/`seven_readonly` grants. It is a server/API schema boundary, not tenant-level row isolation. Do not infer that a hosted project is already locked down from documentation stored in the branch.
2. **`origin/feat/7even-openai-hotel-concierge`: optional product feature.** Adds natural-language stay search through a server-side, validated OpenAI intent parser, with shared rate limiting. Decide whether it belongs in the product before integrating; it needs provider configuration and a cost/privacy review. Review its additional `SEVEN_PREVIEW_READ_ONLY` behavior separately because enabling it suppresses account, booking, payment, refund and webhook mutations in previews.
3. **`origin/fix/vercel-supabase-api-20261018`: extract only the remaining database idea.** Main already has the API routing, serverless pooling, preview-origin and API typecheck work. Commit `2dd3222` additionally pins six trigger functions' `search_path`; main has no such migration. Assess that migration independently and allocate the next available migration number if accepted. Its historical `010` number now collides with `010_hotel_search_indexes.sql`; do not import the old deployment files with it.

The security and trigger-function changes affect database access/financial invariants. They need focused migration/recovery verification and qualified review before production release. This report neither executes nor approves them.

### Why several apparently unmerged branches are redundant

Git commit IDs alone overstate missing work when a branch was squashed. Here are the stronger comparisons used:

- `origin/fix/7even-bounded-keyset-ranking` and `origin/validation/7even-bounded-keyset-ranking` have **identical complete Git trees**. Both exactly equal main commit `3d7eedc`.
- `origin/test/hotel-inventory-readiness` has the **same complete tree** as main commit `779cd31`.
- Every file changed by `origin/fix/7even-set-based-inventory-eligibility` exactly equals its counterpart at main `9f90248`. The only whole-tree difference is the independent 71-line external-directory deletion already applied to main.
- `git cherry` marks the sole bounded-search commit `9d8ac1b` and external-directory-removal commit `7fc3bbb` as patch-equivalent to main.
- The two scalable-candidate commits are ancestors of both keyset branches, so their code is included in the identical squashed tree.
- Main's `store.ts` already implements bulk `offeringProjections` with the 500-window bound, and both search passes use it. Main adds inventory freshness checks which the older bulk branch lacks.
- Main's `vercel.json` already includes the explicit catch-all function, 30-second duration, shared workspace source, and API-preserving rewrites. The older session-routing branch has no remaining configuration to add.

## Local branches

“Main-only / branch-only” means the left/right commit counts from `origin/main...branch`. A branch-only count is a history count, not proof that its code is absent from main. Full SHAs make this snapshot reproducible even if branch names later move.

| Branch | Full tip SHA at review | Main-only / branch-only commits | What it adds | Status and evidence |
| --- | --- | ---: | --- | --- |
| `feat/7even-hospitality` | `26d61a4aaf0ee87411b57df2ac94a5e5ad607e33` | 103 / 0 | Early Apren agent/food-intelligence work, ending with asset identity resolution. The hospitality branch name predates the actual 7even rebuild. | **Stale local history.** Ancestor of main. No unique work; do not merge it back. |
| `feat/7even-hospitality-rebuild` | `d261e6829be734ab106d2bca12eea61b3f2a11f1` | 102 / 0 | Original full 7even hospitality rebuild: public/customer, business/reception/admin, reservations, payments and ledger. | **Already included; stale local.** Ancestor of main; local ref is also 7 commits behind its remote. |
| `feat/logo-wordmark-intro` | `f4492b9b653a3a705adbfbbd1119b65e53d55348` | 0 / 0 | Logo lockup correction and two-line 7 entrance animation requested on 2026-10-21. | **Current work in progress.** Created from this main baseline. This report records its starting tip, before the task commit; keep this active branch. |
| `feat/multi-provider-payments` | `cabd7bdb3aaace0ed15649c4362ac63a1c1bbb2a` | 91 / 0 | Amount-routed Paystack/Flutterwave, direct-wallet USDC on Base, commission receivables, refund/recovery flows and verification documentation. | **Already included; stale local.** Ancestor of main; local ref is 1 commit behind its remote. |
| `main` | `2394f1a10785f37872749a246f72e2028b6d0e63` | 93 / 0 | Local main still points to the Uyo discovery/acceptance-criteria consolidation. | **Stale local baseline.** 93 commits behind fetched origin/main; advance it separately when it is safe to switch checkouts. |

The stale local `main` is 93 commits behind the fetched baseline. Local `feat/7even-hospitality-rebuild` is 7 commits behind its matching remote; local `feat/multi-provider-payments` is 1 behind. Their missing remote commits are already in fetched main. Advance or retire these local refs during normal cleanup, preserving any future local work first. Keep the active logo branch.

## Remote branches already merged by ancestry

Each tip in this table is an exact ancestor of the review baseline. All original commits are already reachable from main.

| Branch | Full tip SHA at review | Main-only / branch-only commits | What it adds | Status and evidence |
| --- | --- | ---: | --- | --- |
| `origin/ci/postgres-integration-tests` | `a078bd6daa437b1128cbbcc407b271e6af039263` | 86 / 0 | Runs the PostgreSQL-backed payment integration suite in GitHub Actions. | **Already included.** Exact tip is an ancestor of main; current unified-system-ci.yml includes the PostgreSQL service and integration step. |
| `origin/cleanup/7even-only-main-20261019` | `1e1bfffa9f1fddd7b01f765153e87425e95e67a7` | 36 / 0 | Removes the preserved Apren/food runtime and narrows the tracked app, tests, documentation and dependencies to 7even. | **Already included.** Exact tip is an ancestor. Current services tree contains platform only. |
| `origin/cleanup/7even-security-scope-wording-20261019` | `bde30d7736f63a0a8a89a5bb35979f58d89a7390` | 31 / 0 | Aligns security/verification wording with the 7even-only source tree and removes obsolete legacy references. | **Already included.** Exact tip is an ancestor. |
| `origin/cleanup/remove-stale-unit-log-20261019` | `00a5fa004bde9e199737906bee50134e549c691c` | 34 / 0 | Removes an obsolete unit-test transcript and updates verification text to avoid reporting pre-consolidation results. | **Already included.** Exact tip is an ancestor. |
| `origin/feat/7even-hospitality-rebuild` | `73d3fd5935fa2a3a84c3c5b458273c3ac2573eda` | 95 / 0 | Full hospitality rebuild plus Uyo arrival/discovery content, integration-role diagnostics and consolidation fixes. | **Already included.** Exact remote tip is an ancestor. It is 7 commits ahead of the matching local branch. |
| `origin/feat/multi-provider-payments` | `7b78bcdf1a9841fb96650f2d018aae996505e67c` | 90 / 0 | Adds routed fiat/direct-USDC payments and fixes Paystack refund-recovery pagination parsing. | **Already included.** Exact remote tip is an ancestor. The extra 7b78bcd provider fix is missing only from the stale local ref, not from main. |
| `origin/fix/7even-api-routing-and-postgres-tls-20261020` | `7decabcb3bb619ee808d56d8a2491581846e0bf7` | 9 / 0 | Restores API routing, verifies Supabase PostgreSQL TLS with its public CA, and separates controlled liveness/readiness from lazy API initialization. | **Already included.** Exact tip is an ancestor; main api/[...path].ts and db.ts retain this behavior. |
| `origin/fix/7even-pwa-booking-start` | `9ff622f6de85ba10c48edd6d80a4cbb70bfc4871` | 2 / 0 | Changes the installed web app launch to hotel discovery, with matching manifest identity/start settings. | **Already included.** Exact tip is an ancestor; merged through PR #34. |
| `origin/fix/7even-vercel-api-origin-20261020` | `d35017c1ec3ca73d0d63bb911426a74419c477dd` | 24 / 0 | Allows configured Vercel origins, secures preview session cookies, typechecks API entrypoints and bounds serverless database pooling. | **Already included.** Exact tip is an ancestor; current app.ts, tsconfig.json and db.ts retain these changes. |
| `origin/fix/7even-vercel-workspace-bundling-20261020` | `2007cd7fe2866fc83655c4a7fac22367807e79df` | 19 / 0 | Includes shared workspace source in the Vercel API bundle. | **Already included.** Exact tip is an ancestor; current function configuration includes packages/**. |
| `origin/fix/preserved-dependency-review` | `bd7692a5ef1fb8b98c0ed4fc3f7e9b577eb22165` | 79 / 0 | Repairs consolidated workspace/root test dependencies and updates the reproducible source manifest and verification evidence. | **Already included.** Exact tip is an ancestor. |
| `origin/fix/production-api-startup-without-payment-keys-20261020` | `a82b3b19361d3e01fd71f10e8e2c016d7a8b8b91` | 16 / 0 | Allows a production API to start with unconfigured payment adapters while defaulting production to live mode instead of implicit mock payments. | **Already included.** Exact tip is an ancestor. This does not prove that live payment credentials or destinations are configured. |
| `origin/merge/multi-provider-payments-main` | `c15912c20935060cdb371ac66db47f37439e43bd` | 88 / 0 | Integration bridge combining multi-provider payments with the then-unified Apren runtime. | **Already included.** Exact tip is an ancestor. Later main cleanup deliberately removes the retired Apren runtime. |
| `origin/reconcile/final-20261018` | `796e2bd5ae352a54ea3bab79d11902bea3766797` | 77 / 0 | Consolidates Apren/7even dependencies, source-manifest reproducibility, root zod declaration and verification records. | **Already included.** Exact tip is an ancestor; historical consolidation evidence, not a missing feature. |
| `origin/refactor/7even-hotel-booking-engine-20261019` | `5971b07e7acf65a211bf41d0a68b3da351e566d6` | 38 / 0 | Refocuses the active engine and discovery UI on hotel booking/ranking, shows room-subtotal estimates and fixes bigint-safe rate checks. | **Already included.** Exact tip is an ancestor. Later search/freshness work builds on it. |

## Remote branches included by squashing, equivalent patches, or later code

These nine refs have commit IDs outside main's ancestry but do not add a missing current-product feature.

| Branch | Full tip SHA at review | Main-only / branch-only commits | What it adds | Status and evidence |
| --- | --- | ---: | --- | --- |
| `origin/feat/7even-bounded-hotel-search` | `9d8ac1baf592beec3682c4d3ddbe0be0ce747c65` | 8 / 1 | Caps candidate retrieval for the first hotel-search implementation and measures candidate/projection/ranking latency. | **Already included by equivalent patch.** git cherry marks its sole commit 9d8ac1b as patch-equivalent to main. Later keyset work replaces the initial fixed cap. |
| `origin/feat/7even-bulk-offering-projections` | `9384dcf2dd19048cb4f0e0336184735bdfc99e68` | 7 / 3 | Replaces repeated per-listing projections with batched offering/inventory reads, preserving input order and the 500-window projection bound. | **Already included in later implementation.** Current store.ts has offeringProjections and the bound; both main hotel-search passes call it. Main adds hotel freshness filtering on top; do not overwrite it with this older version. |
| `origin/fix/7even-bounded-keyset-ranking` | `ad94faeeb6d46042590c695a6a1e5aad41e4f59f` | 6 / 21 | Adds bounded keyset candidate batches, global ranking statistics, repeatable-read ranking passes, hotel search indexes and scale/parity checks. | **Already included by squash.** Whole Git tree exactly equals main squash commit 3d7eedc. Its 21 unique commit IDs do not represent missing code. |
| `origin/fix/7even-db-session-routing-20261020` | `186b6ca919ba73827a795ef57f68c606509abdab` | 21 / 1 | Adds an explicit Vercel catch-all function configuration with maxDuration 30. | **Superseded configuration.** The current main vercel.json already has that configuration plus workspace includeFiles and API-preserving rewrites. Its unique commit is unnecessary. |
| `origin/fix/7even-remove-external-hotel-directory-20261020` | `7fc3bbb1d9d39b605755bdcd7e6357e7dcf8a070` | 5 / 1 | Removes outbound hotel-directory suggestions from Explore so discovery stays within 7even. | **Already included by equivalent patch.** git cherry marks 7fc3bbb patch-equivalent; main b0da00a applies the same removal. |
| `origin/fix/7even-scalable-hotel-candidate-retrieval` | `e1bbb31899902dcd0c5c05a629c0e063e23225c1` | 6 / 2 | Removes the fixed 1,000-candidate ceiling and adds candidate-retrieval indexes. | **Superseded by included keyset work.** Its two commits are ancestors of both keyset branches; their complete tree is already main 3d7eedc. The newer bounded keyset approach should be retained. |
| `origin/fix/7even-set-based-inventory-eligibility` | `62accc2feb13ff2336972710d36a99882a9dda9b` | 5 / 8 | Replaces correlated per-candidate inventory eligibility checks with grouped set-based batches and adds same-fixture parity/benchmark checks. | **Already included by squash.** All three changed files exactly match main squash 9f90248. The only whole-tree difference at that squash is the separately applied 71-line external-directory removal. |
| `origin/test/hotel-inventory-readiness` | `487f5067c00496a481fea36ac1e93afa043001cb` | 3 / 34 | Adds evidence/checklist-based hotel approval, explicit inventory-confirmation freshness, stale hotel filtering across listing/search/availability paths, admin UI, operations docs and isolated tests. | **Already included by squash.** Whole Git tree exactly equals main squash 779cd31. Despite its test/ name it contains production changes; all are already in main. |
| `origin/validation/7even-bounded-keyset-ranking` | `6f2b0cbbdad9b4f02bda6cc7b6ecb6d7620867b4` | 6 / 20 | Alternate history for bounded keyset ranking plus synthetic 1,100+ hotel parity/query-plan checks and migration fixes. | **Duplicate and already included by squash.** Whole tree exactly equals both origin/fix/7even-bounded-keyset-ranking and main squash 3d7eedc. Keeping both branches adds no code. |

## Obsolete remote branches

These target code/build assumptions removed by the 7even-only consolidation. Preserve historical snapshots if wanted; do not restore them into current main wholesale.

| Branch | Full tip SHA at review | Main-only / branch-only commits | What it adds | Status and evidence |
| --- | --- | ---: | --- | --- |
| `origin/feat/remote-dev-control-plane` | `2590d0acf6c59bf7430ae7c72a72fbbe838962d0` | 103 / 5 | Adds Apren CI/manual audit/build workflows and removes a recursive root npm install hook. | **Obsolete for current 7even.** Targets the old workspace, Node 22, nested web lockfile and build:web script. Main uses Node 24, the root lockfile, npm run build and unified-system-ci.yml. Do not merge these workflows wholesale. |
| `origin/fix/apren-engine-route-registration-20261019` | `4083701c6f76f626aa25e7922f74cd098b93afc2` | 76 / 2 | Registers the old Apren brain/economy routes at startup and adds route-registration assertions. | **Obsolete after runtime removal.** Both changed paths belong to services/apren-engine or tests/engine, removed by the 7even-only cleanup. No active 7even caller remains to repair with this branch. |
| `origin/fix/apren-simulated-action-safety-20261019` | `fa285526ce1669a70076d6a0478437f7c85b94e6` | 76 / 9 | Makes old Apren autonomous actions explicitly simulated, rejects unsupported actions, and stops treating unverified food evidence as verified. | **Obsolete after runtime removal.** All seven changed paths belong to the removed Apren engine/tests. Useful historical evidence, but merging it would restore a retired product rather than fix active 7even. |

## Remote branches needing a decision

| Branch | Full tip SHA at review | Main-only / branch-only commits | What it adds | Status and evidence |
| --- | --- | ---: | --- | --- |
| `origin/feat/7even-openai-hotel-concierge` | `da5572514fc08a76be0e2a5d193cc178661c9064` | 3 / 12 | Adds a natural-language stay-search form, server-side OpenAI structured-intent parser, shared PostgreSQL rate limiting, date/budget validation and an optional read-only preview guard. | **Needs product/configuration decision.** 12 unique commits; aiConcierge.ts and /ai/interpret-search are absent from main. Review as a separate feature. The opt-in preview guard also blocks account, booking, payment, refund and webhook writes. |
| `origin/fix/vercel-supabase-api-20261018` | `2dd3222b19f1367a313b833a4c46e633db165698` | 76 / 6 | Early Vercel API/origin/pool/typecheck setup plus a migration pinning six financial/immutability trigger functions' search_path. | **Mostly superseded; preserve one candidate.** Three commits are patch-equivalent; the current implementations also cover the origin and API typecheck changes. The search_path migration 2dd3222 is absent from main and merits an isolated database review/port, not a whole-branch merge. |
| `origin/security/lock-down-seven-data-api` | `4488f44d6ea12908875712063b344743600cf875` | 2 / 6 | Adds internal-seven-table RLS, policies for existing server roles, a local boundary test, and a separate Supabase-admin script/documentation removing seven from the public Data API. | **Relevant unmerged hardening; review required.** Six unique commits and five new files are absent from main. These policies preserve server-role table access; they do not introduce tenant-by-tenant RLS. Hosted database state is not established by the branch or its 'applied' wording. |

## Main baseline

| Branch | Full tip SHA at review | Main-only / branch-only commits | What it adds | Status and evidence |
| --- | --- | ---: | --- | --- |
| `origin/main` | `f4492b9b653a3a705adbfbbd1119b65e53d55348` | 0 / 0 | Current 7even hotel booking platform, including provider routing, bounded hotel search, inventory freshness and installed-app hotel discovery. | **Review baseline.** Baseline f4492b9; no difference from itself. |

## Suggested cleanup order

1. Keep main and the new logo feature branch. Review the three retained candidates separately against current main.
2. Once repository owners approve cleanup, remove the 24 redundant remote branch names. Their relevant code is already in main. No deletion was performed here.
3. Archive or remove the three obsolete Apren/control-plane branch names if their historical purpose is no longer needed.
4. Refresh the stale local refs separately, without resetting or overwriting future uncommitted work.

## Verification scope

Used fetched refs, `git for-each-ref`, full tip SHAs, merge-base ancestry, left/right commit counts, `git cherry` patch equivalence, branch-to-squash tree comparisons, changed-file comparisons, and direct inspection of affected source/configuration. The fetched main baseline was pinned throughout rather than comparing against the stale local main.

Read-only review of application code. No application tests, branch checkouts, migration execution, hosted database checks, CI runs, deployment checks, or external provider calls were needed or performed for this branch inventory. A branch's test files or commit messages are evidence of intended scope, not proof that its current tests pass. Branches added or advanced after the fetched snapshot require a new comparison.
