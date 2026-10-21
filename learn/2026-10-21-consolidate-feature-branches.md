# Combining branches without reviving old code

2026-10-21 · Consolidate the open feature branches and verify the combined app.

## In short

The integration contains every fetched branch tip while keeping the current 7even engine and deployment setup. It adds the missing concierge and database changes, corrects their integration gaps and records the checks. Main remains unchanged while the required production review is pending.

## What changed

- `Brand.tsx`, `BrandIntro.tsx`, `main.tsx`, `global.css` and `brand-intro.css`: merged the already-tested logo feature.
- `ExplorePage.tsx` and `public.css`: connect the concierge form to the existing pop-up feedback and responsive form styles.
- `aiConcierge.ts`: requires explicit key/model configuration and asks for missing dates; validates output and converts budgets using integers.
- `accounts.ts` and `app.ts`: integrate shared PostgreSQL rate limiting, the intent endpoint and the preview HTTP write guard.
- Migrations `012`, `013` and `014`: add internal-table RLS policies and fixed trigger-function search paths. Existing migrations stay unchanged.
- `database/operations/README.md` and its SQL script: retain the separate, unexecuted Supabase administrator operation.
- `ai-concierge.test.ts`, `ai-search-http.test.ts`, `preview-read-only.test.ts` and `seven-api-boundary.test.ts`: cover parser failures, real HTTP/database throttling, preview boundaries, roles and trigger configuration.
- `ui.tsx`: removes an invalid ARIA label; the visible booking score remains.
- `.env.example`, README, API contract, operations/file guides and consolidation report: document configuration, behavior and review limits. Browser evidence is saved under `design/explorations/verification/consolidation/`.

## How it works

1. Git ancestry and content comparisons distinguish missing features from equivalent or retired work.
2. An ancestry-only merge records superseded histories while preserving the current tree. Ordinary merges bring in actual missing code.
3. A stay request passes origin/CSRF validation and a shared database counter before reaching the configured provider. Provider output must pass the strict schema. Incomplete dates produce a clarification pop-up.
4. Valid intent becomes ordinary search filters. The existing engine checks inventory and computes ranking; the model cannot book or set prices.
5. Migrations preserve existing role grants while adding policies and trigger configuration. Local integration tests use a separate disposable database.

## Why it's built this way

Blindly combining old file versions would restore retired Apren code and replace newer API fixes. Preserving ancestry and resolving content separately keeps history complete without undoing later decisions. Reusing feedback and search components keeps the new feature consistent with the app.

## The concept worth knowing: ancestry versus content

Two notebooks can contain the same lesson written on different dates. Git commits likewise can have different identities but identical files, especially after a squash merge. An ancestry check proves a commit is in history; a tree or patch comparison proves whether its code is already present. Both are needed here.

## Watch out for

Local checks passed: 242 unit tests, 188 integration tests, build, lint and browser checks. Lint still reports warnings. Provider doubles do not prove real payment, OpenAI or wallet delivery. The privileged Supabase operation was not run. Main is production-connected, so qualified human review remains the final gate.

## Check yourself

1. Why not merge every old file version automatically?
   <details><summary>Answer</summary>Later main changes deliberately replace or remove some of that code. Automatic conflict choices could undo those decisions.</details>
2. What if two app instances receive requests together?
   <details><summary>Answer</summary>The PostgreSQL counter is shared and incremented atomically, so instances cannot each offer a separate allowance.</details>
3. Why does a passing migration test not prove tenant isolation?
   <details><summary>Answer</summary>These policies preserve broad server-role access. Application checks must still authorize each user and business.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
