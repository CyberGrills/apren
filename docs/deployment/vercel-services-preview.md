# Vercel Services preview setup

## Intended routing

- Public ingress: the Vite web service only. Its local rewrite provides SPA deep-link fallback to `/index.html`.
- Private services: `platform`, `assets`, `gateway`, `identity`, `intelligence`, `market`, `trade`, and `wallet`. The top-level public rewrite table intentionally targets only `web`.
- The legacy gateway has bindings to the six legacy services it already calls. The binding environment names match the existing `ASSETS_URL`, `IDENTITY_URL`, `WALLET_URL`, `MARKET_URL`, `INTELLIGENCE_URL`, and `TRADE_URL` reads.
- The active web and platform workspaces use explicit `file:../../packages/...` dependencies. Their Vercel service install commands install from the repository workspace root, and the web build command targets the `@7even/web` workspace.

This is a frontend-only preview. Browser requests to `/api/*` intentionally do not reach the private platform service, so API-backed screens are not expected to work in this preview.

## Runtime changes

- `services/platform/src/server.ts` and all seven legacy Express entrypoints export their apps for Vercel and only open local HTTP listeners outside Vercel. The platform 15-second recovery timer also runs only outside Vercel; process-local timers are not treated as durable scheduled jobs.
- `scripts/validate-vercel-services.mjs` checks service roots, entrypoints, bindings, and the web-only public ingress policy.
- `.github/workflows/vercel-services-validation.yml` runs the static validator, TypeScript typecheck, web build, and legacy entrypoint syntax checks using Node 24.

## Deployment prerequisites and remaining production gates

1. In Vercel project settings, set the project framework to **Services**. The repository file alone cannot change that account-level setting.
2. Vercel Services must be enabled for the account/project. If the project does not have access, the configuration cannot deploy until access is granted.
3. Set required environment variables in Vercel project settings. The platform API enforces production payment configuration and HTTPS origin requirements. Do not commit secrets.
4. The legacy assets service initializes a local SQLite database using `better-sqlite3`. Its write data is not durable on ephemeral function filesystems. The service can be built and invoked, but do not rely on its writes surviving instance replacement. Before production use, migrate to a persistent database or provide a supported durable storage layer and validate its schema/data migration.
5. The recovery worker is intentionally disabled in Vercel request processes. Before production use, schedule it through a durable job/queue mechanism and add retry/idempotency monitoring.
6. The identity and wallet services import `legacy/services/shared/db.js` from outside their individual service roots. Their config includes `../shared/**`; the platform service similarly includes the two workspace packages. Confirm these files are present in the actual Vercel bundles during the first real build.
7. Run the new GitHub Actions checks, then a real Vercel preview. Verify the root and deep links, ensure no backend has public ingress, and test the gateway bindings from inside its runtime. A successful static check is not proof of a successful deployment.

No live preview is claimed until Vercel reports a successful deployment and runtime smoke tests pass.
