# 7EVEN / āprən repository structure

The repository root is **apren**. Keep the customer-facing 7EVEN application and the supporting āprən intelligence/platform services in clearly separated top-level folders.

## Top-level layout

```text
apren/
├── frontend/                 # 7EVEN customer, business and admin interfaces
├── api/                      # Thin Vercel-only entry point shim\n├── backend/
│   ├── api/                  # Thin Vercel HTTP entry point(s)
│   └── platform/             # Server runtime, domain services and adapters
├── packages/
│   ├── contracts/            # Shared API contracts and validation
│   └── engine/               # Deterministic hospitality/booking logic
├── database/                 # Migrations and controlled operations
├── tests/                    # Frontend, integration and tooling tests
├── docs/                     # Product and engineering documentation
├── design/                   # Design explorations and visual QA evidence
├── learn/                    # Dated historical engineering notes
├── scripts/                  # Developer and release tooling
├── .github/                  # CI workflows
├── package.json              # Root workspace and commands
├── package-lock.json         # Authoritative dependency lockfile
└── vercel.json               # Production deployment configuration
```

## Ownership boundaries

| Area | Owner | Responsibility |
|---|---|---|
| `frontend/` | Frontend developer | React routes, components, styles, public assets, PWA and offline-first customer experience |
| `backend/api/` | Backend developer | Thin HTTP/Vercel entry points only; no business logic duplicated here |
| `backend/platform/` | Backend developer | API application, authentication, inventory, booking, payments, persistence and service runtime |
| `packages/contracts/` | Shared; coordinate changes | Types, schemas and request/response contracts consumed across frontend and backend |
| `packages/engine/` | Shared; coordinate changes | Deterministic domain and booking rules |
| `database/` | Backend developer | Reviewed migrations and controlled database operations |
| `tests/` | Shared | Frontend, integration, contract and tooling verification |
| `docs/` | Shared | Current implementation guides, onboarding, product decisions and operations |

## Frontend layout

Within `frontend/src/`, retain the existing feature boundaries:

- `components/`: reusable UI components.
- `context/`: application-wide providers and state.
- `hooks/`: reusable React hooks.
- `lib/`: typed client logic, utilities and local persistence.
- `pages/public/`: public discovery and marketing routes.
- `pages/customer/`: customer account and booking routes.
- `pages/workspace/`: business, reception and admin workspace routes.
- `styles/`: global and feature stylesheets.

Static assets remain in `frontend/public/`. Keep imported source and styles in `frontend/src/`.

## Backend layout

- Root `api/` contains the thin Vercel entry-point shim required by Vercel's root-only function discovery. Keep it free of business logic.\n- `backend/api/` contains the backend-owned HTTP handler implementation. The root shim delegates to it.
- `backend/platform/src/` contains server-side application composition, domain services, persistence and provider adapters.
- `database/migrations/` contains ordered, reviewed SQL migrations.
- `database/operations/` contains controlled operational SQL and runbooks. Never store credentials or database dumps here.

## Working rules

1. The repository itself is named `apren`; do not create a second nested `apren/apren` folder.
2. Frontend work belongs in `frontend/`; backend work belongs in `backend/`.
3. Shared contracts and engine rules remain in `packages/`; coordinate changes across both teams.
4. Do not create nested lockfiles or duplicate package manifests. The root package manager configuration remains authoritative.
5. Do not move API contracts, database schema, production data or payment behaviour as part of folder organization.
6. Before changing a path, update imports, scripts, tests, CI, Docker, Vercel configuration and documentation references.
7. Never commit `.env`, credentials, customer exports, database dumps, build output, dependency folders, caches or temporary files.
8. Preserve existing product behaviour and brand conventions: 7EVEN is the customer-facing hospitality brand; āprən is its supporting intelligence engine.

## Developer handoff

- Frontend developer: work in `frontend/`; use root commands such as `npm run dev`, `npm run typecheck`, `npm test` and `npm run build`.
- Backend developer: work in `backend/api/`, `backend/platform/` and `database/`; coordinate shared contract changes before merging.
- Both developers: open focused pull requests against `main`. Do not commit directly to production or introduce a second preview/production repository.
