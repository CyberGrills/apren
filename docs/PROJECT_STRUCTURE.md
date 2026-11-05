# 7EVEN repository structure

This repository is a workspace monorepo. Keep the existing runtime boundaries stable: move files only when their ownership is clear and every import, script, CI path, deployment setting and documentation link has been updated.

## Top-level layout

| Path | Responsibility | What belongs here |
|---|---|---|
| `apps/web/` | Customer and workspace frontend | Browser app, public assets, PWA files and frontend source |
| `services/platform/` | Platform/API runtime | HTTP routes, domain services, persistence adapters and server-side workflows |
| `packages/contracts/` | Shared interfaces | API contracts, schemas and types shared across workspaces |
| `packages/engine/` | Booking and decision logic | Deterministic, reusable domain rules and engine tests |
| `database/migrations/` | Database evolution | Ordered, reviewed SQL migrations |
| `database/operations/` | Controlled database operations | Explicit operational SQL and runbooks; never credentials or dumps |
| `tests/` | Cross-workspace verification | Frontend, integration and fixture tests |
| `scripts/` | Developer and release tooling | Build, start, smoke-test and maintenance scripts |
| `docs/` | Product and engineering documentation | Architecture, API contracts, operations, security, onboarding and project guides |
| `design/` | Design source and review evidence | Explorations, prototypes, screenshots and visual QA |
| `learn/` | Historical engineering notes | Dated investigations and decisions; link current guidance from the relevant docs |
| `.github/workflows/` | CI automation | GitHub Actions workflows |
| `api/` | Deployment entry points | Thin platform/deployment adapters only |

## Frontend layout

Within `apps/web/src/`, keep the current feature boundaries:

- `components/`: reusable UI components shared by multiple routes.
- `context/`: application-wide React providers and state contexts.
- `hooks/`: reusable React hooks.
- `lib/`: framework-light utilities, typed client logic and local persistence helpers.
- `pages/public/`: public discovery, directory and marketing routes.
- `pages/customer/`: signed-in customer account and booking experience.
- `pages/workspace/`: authenticated workspace route entry points and role-owned supporting components. Keep route-level pages such as `AdminPage.tsx`, `BusinessPage.tsx` and `ReceptionPage.tsx` in this root while their supporting components are grouped under `admin/`, `business/` and `reception/`.
- `pages/workspace/shared.tsx` and other root-level workspace modules: components intentionally reused across roles; keep them at the workspace root until their ownership is unambiguous.
- `styles/`: global and feature-scoped stylesheets.
- `public/`: static files served as-is; keep brand, media, data and audio in their existing asset subfolders.

A component used by only one page should normally stay near that page. Promote it to `components/` only when it is genuinely shared. Keep route composition in `App.tsx` and application mounting in `main.tsx`.

## File placement rules

1. Keep each file with the workspace that owns and executes it. Do not place frontend code in `services/` or server code in `apps/web/`.
2. Keep tests beside the module when they are module-specific; use `tests/frontend/` or `tests/integration/` for cross-module behaviour.
3. Put user-facing product specifications and current engineering guidance in `docs/`. Put dated research notes in `learn/`.
4. Put prototypes, design references and visual verification captures in `design/`; do not import these files into production bundles.
5. Keep static browser assets in `apps/web/public/`; keep source code and imported styles in `apps/web/src/`.
6. Do not commit `.env`, credentials, customer exports, database dumps, build output, dependency folders, caches or temporary files.
7. Avoid generic dumping-ground folders such as `misc/`, `old/` or `temp/`. Archive material only when its retention purpose and owner are documented.
8. Before moving or renaming a file, search for imports, dynamic imports, test globs, npm scripts, CI workflows, Vercel configuration and documentation links that reference its old path.
9. Do not change workspace names, package boundaries, API contracts, database structure or deployment behaviour as part of a file-organization change.
10. Prefer small, reviewable moves grouped by one domain. Run typecheck, lint, unit tests, integration tests where configured, and production build after each group.

## Offline-first frontend files

Offline experience code belongs in the existing frontend boundaries:

- `apps/web/src/components/OfflineExperience.tsx`: shared connectivity status UI.
- `apps/web/src/components/OfflineSaveButton.tsx`: reusable save-to-device control.
- `apps/web/src/lib/offlineStore.ts`: IndexedDB persistence and types.
- `apps/web/src/pages/public/OfflinePage.tsx`: customer-facing Offline space route.
- `apps/web/src/styles/offline.css`: offline feature styles.
- `apps/web/public/sw.js`: service-worker caching strategy.
- `apps/web/src/lib/offlineStore.test.ts`: persistence tests.

These files remain frontend-only. Backend sync, live availability, booking lifecycle, authentication, payment verification and secure account-record storage must be implemented and reviewed by the backend owner under separate contracts.

## Workspace and change boundaries

The root `package.json` defines the npm workspaces: `apps/web`, `services/platform`, `packages/contracts` and `packages/engine`. The root `package-lock.json` is authoritative for dependency resolution. Do not create nested lockfiles or duplicate package manifests to reorganize folders.

For a file-organization pull request:
- preserve `main` and the active feature branches;
- do not merge or deploy as part of the organization change;
- show a before/after path list;
- explain any compatibility path or import updates;
- confirm that no runtime behaviour, API, database or production data changed.

This guide describes the current repository layout and the rules for future cleanup. It is not a request to move stable files simply to make the tree look different.
