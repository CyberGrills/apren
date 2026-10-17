# āprən

This repository contains a multi-package Apren application composed of a React web app and several Node.js backend services.

## Project layout

- `apps/web` - Vite + React frontend
- `services/assets` - Food asset engine and SQLite-backed asset profile service
- `services/intelligence` - Asset intelligence service
- `services/identity` - Identity / user service
- `services/wallet` - Wallet service
- `services/gateway` - API gateway routing requests to backend services
- `services/market` - Market engine stub service
- `services/trade` - Trade engine stub service

## Quick start

```bash
cd /home/CyberShef/apren
npm install
```

### Start individual services

```bash
npm run start:gateway
npm run start:assets
npm run start:intelligence
npm run start:identity
npm run start:wallet
npm run start:market
npm run start:trade
npm run start:web
```

### Start all services together

```bash
npm run start:all
```

### Build frontend

```bash
npm run build
```

## Ports

- `apps/web` dev server: `http://localhost:5173`
- `services/gateway`: `http://localhost:4000`
- `services/identity`: `http://localhost:4001`
- `services/wallet`: `http://localhost:4002`
- `services/assets`: `http://localhost:4003`
- `services/market`: `http://localhost:4004`
- `services/intelligence`: `http://localhost:4005`
- `services/trade`: `http://localhost:4006`

## Notes

- This repository uses npm workspaces to manage packages from the root.
- The root `package.json` is private and only used to orchestrate workspace scripts.
- The `start:all` command uses `concurrently` to run services in parallel.

## Recommended next steps

1. Add service environment configuration using `.env` files
2. Add tests for service endpoints and frontend rendering
3. Add linting and formatting for JavaScript/JSX code
4. Add a `docker-compose.yml` for local orchestration if needed
