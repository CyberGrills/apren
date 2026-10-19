# 7even Architecture

## Product and runtime boundary

7even is the only active product in this repository. The current runtime uses four npm workspaces: the React web application, the platform API, shared contracts and the deterministic 7even engine package. The hotel-booking optimizer is part of that engine package; it is not a separately started service.

## Active components

- **apps/web** — public hotel discovery and booking, customer accounts, business tools, reception workflows and administration, presented under the 7even brand.
- **services/platform** — same-origin HTTP API, authentication and authorization, offerings, inventory, quote and reservation transactions, payments, rewards, reception sync and recovery.
- **packages/contracts** — shared request validation and response types.
- **packages/engine** — deterministic hotel matching and ranking plus exact money, dates and lifecycle rules.
- **PostgreSQL** — authoritative published listings and room inventory, quote/hold state, reservations and payment records.
- **Payment and messaging adapters** — external provider integrations are server-side and require live credentials and external acceptance testing before production use.

## Hotel-search and booking flow

1. The web app requests published STAY offerings from the 7even platform.
2. The platform reads the current PostgreSQL listing projection and current inventory windows.
3. The hotel optimizer excludes stays that cannot cover every requested night and room quantity, have expired or ambiguous inventory, exceed the requested base-room budget, or fail required criteria.
4. Remaining stays are ranked using location fit, base room subtotal, requested amenities and availability. Responses expose a transparent score, checked-at time, available room count, estimated base subtotal and explanation.
5. Search is read-only. When a guest asks to book, the quote path recalculates the authoritative price, and the hold/reservation transaction locks inventory for every requested night. A search result cannot guarantee inventory will remain available if another guest books first.

## Ranking policy

The current policy identifier is 7even-hotel-ranking-v1. It is deterministic and explainable; it does not fabricate review ratings or predictive confidence and does not automatically change hotel prices. The displayed search subtotal is an estimate before final quote rules such as applicable taxes, discounts and provider fees. The server quote is authoritative.

## Health and verification

- GET /api/engine/booking/health identifies the 7even hotel-booking engine and live PostgreSQL inventory source.
- GET /api/offerings?kind=STAY supports city, stay dates, room count, amenities and maximum base subtotal filters.
- Unit and PostgreSQL integration tests cover ranking, multi-night availability, capacity, expired/missing/ambiguous inventory, budgets and invalid dates.

The ranking path is part of 7even's platform boundary. All current executable entry points launch the 7even API and web app only. Historical versions are preserved by Git history rather than a second product runtime.
