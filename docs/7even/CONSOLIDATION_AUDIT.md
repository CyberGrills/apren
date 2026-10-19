# 7even Source Consolidation Audit

## Result

The current source tree is organized around one active product: 7even. The root npm package is named 7even, and its workspace list is limited to the application, platform API, shared contracts and engine package. The current branch does not include a second product runtime or the retired prototype's source, brand assets or maintenance scripts.

## Workspace inventory

| Workspace | Responsibility |
|---|---|
| apps/web | 7even web and installable app interfaces |
| services/platform | 7even API and authoritative domain workflows |
| packages/contracts | Shared validated contracts |
| packages/engine | Hotel availability filtering, explainable ranking, exact money/date/lifecycle rules |

## Hotel-booking engine boundary

- Hotel matching reads approved, published STAY listings and current PostgreSQL inventory.
- Every requested night must have unambiguous, non-expired inventory with enough rooms.
- Ranking happens before pagination so a page is selected from the best matching candidate set.
- Search totals are base-room subtotal estimates. Quote and reservation transactions remain authoritative for current pricing and room locks.
- The engine does not fabricate ratings, claim trained demand prediction or alter hotel prices automatically.

## Runtime and data safety

- Local start scripts run the 7even platform API and 7even web app only.
- Database migrations and fixtures are explicit scripts; seed data is not imported from external or historical records.
- Executable source and configuration are limited to the current workspaces. Earlier source states remain retrievable in Git commit history, not as a parallel runtime directory.

## Verification boundary

The completed PR #14 checks at head 5971b07e7acf65a211bf41d0a68b3da351e566d6 passed clean installation, typecheck, build, 240 unit tests and 168 PostgreSQL integration tests; one integration case was skipped and no test failed. This documents that pre-cleanup runtime revision. The current source cleanup is documentation and retired-file removal only, so its own post-change GitHub Actions run must still complete before release claims are made.

A successful CI run is not a deployment confirmation. Check current workflow and hosting status separately, and complete live payment provider, mail, wallet, recovery and production-security acceptance checks before enabling real-money traffic.
