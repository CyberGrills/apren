# 7even hotel booking engine

## Product and engine boundary

- **7even** is the sole active product brand.
- The booking optimizer ranks published hotel listings using current PostgreSQL inventory, stay dates, requested room quantity, base room subtotal, location and requested amenities.
- The optimizer is a pure module in `packages/engine`. It does not maintain a second database, food asset catalogue or detached runtime.
- `services/platform` remains the source of truth for approved listings, inventory windows, pricing policies, quotes, reservation holds, payment states and room-capacity locks.
- `apps/web` submits hotel search criteria and displays the match score/reasons. The final quote and reservation endpoints revalidate live capacity before allocating rooms.

## Real-time search behavior

Every hotel search loads currently published listings for approved businesses and reads their current inventory. If check-in/check-out are supplied, every night must have exactly one matching inventory window, the requested number of rooms must remain available on every night, and the inventory window must not have expired. If dates are omitted, each listing is evaluated against its next currently bookable night. The optimizer filters unbookable results, ranks all eligible hotel matches before paginating, and records the check time with the result.

The ranking uses base-rate competitiveness, available-room headroom, city match and optional amenity matches. The weights are versioned as `7even-hotel-ranking-v1`. It uses no fabricated ratings, review counts, guest preferences, demand probabilities or machine-learning claims. The estimate is the base room subtotal before tax, approved discounts and provider fees; the checkout quote is authoritative.

## Booking safety

Ranking is advisory; it does not reserve inventory. A quote checks the exact stay dates and current capacity. Creating a reservation re-locks each room-night inventory row and atomically allocates capacity, so a search result cannot guarantee a room remains free if another customer books first. Capacity conflicts return an explicit response and the customer must refresh/re-quote.

## Runtime and verification

- `npm run dev`: starts the platform API and web development server.
- `npm start`: starts the platform API and serves the built UI.
- `GET /api/engine/booking/health`: reports the booking engine contract and database-backed published-hotel count.
- `npm test`: includes deterministic unit tests for stay coverage, current inventory, room quantity, budget, city/amenity fit, ranking and invalid search criteria.
- `npm run test:integration`: verifies the platform against an isolated PostgreSQL test database.

No separate food engine or second inventory database is part of the active runtime.
