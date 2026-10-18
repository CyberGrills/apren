# āprən + 7even consolidation audit

## Canonical runtime

- services/apren-engine/ is the āprən decision/engine service.
- services/platform/ is the 7even platform API and integration boundary. Its /engine/apren/health route probes the engine's /healthz endpoint.
- apps/web/ is the 7even customer-facing web application. In local development, Vite serves port 5177 and proxies /api to the platform API on port 7077.
- packages/contracts/ and packages/engine/ are shared workspace packages. The root npm run dev starts the engine, platform API, and web application together; npm start starts the two server-side services for a production deployment where the web bundle is hosted separately.

The workspace has one active implementation for each of those roles. Legacy implementations remain under legacy/ for reference and are not started by the root runtime.

## Exact duplicate-file review

The hash inventory found exact duplicates only in distinct asset contexts or archived legacy material:

- apps/web/public/brand/7even-logo.jpeg and design/explorations/assets/7even-logo-original.jpeg are identical bytes used from separate production-public and design-exploration paths. Both paths are retained because their consumers and deployment roots differ.
- legacy/web-icons/1-removebg-preview (1).png and legacy/web-icons/apren-favicon.png, and legacy/web-icons/2-removebg-preview (1).png and legacy/web-icons/apren-logo.png, are duplicate aliases inside the archived legacy bundle. They are not active 7even runtime assets; filenames are retained to avoid breaking historical references.
- Identical AprenApp.jsx timestamped snapshots are archived under legacy/web-src/features/apren/. They are recovery/audit snapshots, not active imports, and remain preserved rather than being deleted as if they were duplicate runtime modules. The legacy review index paths for these snapshots have been corrected to the actual archive location.

No active engine, platform, contract, or web source module was removed solely because its contents looked similar. Distinct runtime responsibilities and historical evidence are preserved.

## Validation contract

A consolidation release is only considered verified after workspace typecheck, production web build, unit tests, lint, dependency audit, PostgreSQL integration tests where a disposable test database is available, and runtime smoke tests for the engine, platform API, and web proxy.

## Verification snapshot (18 October 2026)

| Check | Result |
|---|---|
| TypeScript workspace typecheck | Passed |
| Production web build | Passed; Vite reports the existing 547.39 kB main chunk warning |
| Unit tests | 235 passed, 0 failed, 0 skipped |
| Lint | Exit 0; 187 warnings and 4 information diagnostics remain |
| npm dependency audit | 0 known advisories |
| Integration suite without a disposable test database | 106 passed, 0 failed, 7 database-backed cases skipped because TEST_DATABASE_URL was not configured |
| Runtime smoke: Apren engine /healthz | HTTP 200 |
| Runtime smoke: 7even API /api/health/live | HTTP 200 |
| Runtime smoke: 7even-to-āprən engine health | HTTP 200, engine status ok |
| Runtime smoke: web home and Vite /api proxy | HTTP 200 |
| Runtime smoke: 7even /api/health/ready | HTTP 500 because the local apren database has not been migrated and seven.migrations is absent; no schema was added to the existing database during this smoke test |

The PostgreSQL-backed cases must pass in GitHub Actions against its isolated PostgreSQL service before the consolidation can be called fully verified. The local smoke confirms process startup and the web/API/engine route between 7even and āprən, but does not claim database readiness against an unmigrated database.
