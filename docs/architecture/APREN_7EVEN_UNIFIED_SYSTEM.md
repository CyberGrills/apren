# Apren engine + 7even product: unified repository

## Product boundary

- **Apren** is the intelligence engine: food assets, food evidence/freshness, valuation, food economy, lifecycle, and food-brain/decision APIs.
- **7even** is the user-facing hospitality brand/product: hotel discovery, reservations, availability, payment, rewards, reception and admin workflows.
- The 7even rebuild branch is intentionally left unchanged. Its product code is already represented in `main`; this consolidation only changes `main` and promotes Apren's engine service behind a separate runtime boundary.

## Active runtime map

| Path | Ownership | Runtime role |
| --- | --- | --- |
| `apps/web` | 7even | User-facing web UI; unchanged by this consolidation |
| `services/platform` | 7even | Hospitality API, PostgreSQL schema `seven`, identity, reservations, payments and rewards |
| `services/apren-engine` | Apren | Existing food asset/food-brain API promoted from `legacy/services/assets` |
| `packages/engine` | 7even | Hospitality pricing, lifecycle and demand rules; not the Apren food-brain engine |
| `packages/contracts` | Shared API contracts | Request validation and typed API contracts |
| `legacy/services/*` (except the promoted assets engine) | Historical Apren archive | Not active workspaces and not started by the unified runtime |
| `legacy/web-src` and `legacy/scripts` | Historical archive | Not part of the active web build |

## Runtime commands

- `npm run dev` starts the Apren engine on port 4003, the 7even platform on port 7077, and the 7even Vite UI on port 5177.
- `npm start` starts both backend services. The platform receives `APREN_ENGINE_URL`, defaulting locally to `http://127.0.0.1:4003`.
- `GET /healthz` on the Apren engine reports its local service health.
- `GET /api/engine/apren/health` on the 7even API checks the configured Apren engine and returns `ok`, `unavailable`, or `not_configured`.

## Duplicate-file policy

The old Apren source contains several same-named engine modules with different implementations (for example, decision, valuation, forecasting, memory and execution engines). They are not byte-identical and must not be merged based on filenames alone. Some are historical/unreferenced variants; this consolidation preserves the engine source rather than deleting potentially meaningful behavior. Backup snapshots in the promoted engine folder were removed from the active tree; their previous contents remain in Git history. The old 7even UI and duplicate service implementations remain under `legacy/` as reference only and are not included in root workspaces.

## Persistence and release gates

The Apren engine currently uses its original SQLite database under its service source tree. That is suitable only for local compatibility/testing; migrate it to durable PostgreSQL or another supported persistent store before production deployment. The 7even platform continues to use PostgreSQL schema `seven`. The Apren engine is reachable from the 7even API through `APREN_ENGINE_URL`, but hospitality decisions must not be coupled to food-specific endpoints until a domain-appropriate contract is defined.
