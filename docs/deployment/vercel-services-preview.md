# Vercel Services preview setup

## Intended routing

- Public ingress: the Vite web service only (`/` and SPA deep links).
- Private services: `platform`, `assets`, `gateway`, `identity`, `intelligence`, `market`, `trade`, and `wallet`. There are intentionally no public rewrite rules to these services.
- The legacy gateway has bindings to the six services it already calls. Its existing `ASSETS_URL`, `IDENTITY_URL`, `WALLET_URL`, `MARKET_URL`, `INTELLIGENCE_URL`, and `TRADE_URL` environment-variable reads match the binding names.

The web-only preview is intentionally a visual/frontend preview. Browser requests to `/api/*` are not routed to the private platform API in this mode, so API-backed screens are not expected to work until a separately approved public API route or a server-side web proxy is designed.

## Validation status

This file records the intended Vercel Services topology; it is **not a verified successful deployment**. Vercel Services must be enabled as the project's framework in Vercel project settings as well as defined in this file.

Static repository inspection found runtime integration blockers that must be resolved before treating the services as deployable:

1. The active `services/platform/src/server.ts` starts an HTTP listener and a periodic recovery worker. A normal Express/serverless entrypoint needs an exported request handler; the worker also needs a durable scheduled/background execution design rather than relying on a function process staying alive.
2. The active platform package depends on root workspaces `@7even/contracts` and `@7even/engine`. A service rooted at `services/platform` must be built with those workspace packages available, not installed as an isolated package with unresolved `*` dependencies.
3. Legacy service entrypoints call `app.listen(...)` instead of exporting an Express app/handler. The assets service also depends on `better-sqlite3` and initializes local database state. These require a compatible runtime and persistence plan; an entrypoint path alone does not make them serverless-compatible.
4. The platform API enforces production payment configuration and HTTPS origin requirements. Production secrets must be configured in Vercel environment settings; never commit them to this repository.

## Next validation gates

- Enable the Vercel Services framework for the project.
- Add runtime adapters/build configuration for each service and decide the legacy SQLite/Postgres persistence model.
- Run a clean build for each service, then run `vercel dev -L` or a real Vercel preview deployment.
- Verify the public web root and deep links, confirm private services have no public ingress, and test each gateway binding from within the gateway runtime.
- Only call this ready after a real deployment and smoke tests succeed.
