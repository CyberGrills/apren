# 7even engine

Pure TypeScript rules shared by the platform. There is no database, clock, network or provider access in this package.

`src/index.ts` exports the public functions and types. Run `npm test --workspace @7even/engine` with Node 24. The tests use Node's built-in test runner and disable process isolation so every individual case is visible in the current development environment.

## Money and points

- `parseMinor` accepts canonical integer strings from `0` to `999999999999999`. It returns `bigint` and rejects signs, whitespace, decimals, exponent notation and leading zeroes.
- `majorToMinor` converts an NGN decimal string with at most two decimal places to a kobo string without floating point.
- `formatMoney` displays exact two-decimal amounts. NGN uses `₦`; an explicit three-letter currency label uses that label. The current platform's pricing contract is NGN.
- `quotePrice` multiplies unit price by quantity and units, rounds the discount half up, taxes the discounted service, and calculates commission on that service before tax. The default commission is 1,000 basis points, or 10%. Every output amount is bounded. `businessGrossMinor` is the total less commission, before actual provider fees.
- `earnPoints` floors `serviceMinor × points / spendMinor` using integers. Zero earning rates are valid, but a zero denominator is not. It rejects outputs above JavaScript's safe integer range.

The caller supplies approved tax, earning and discount policies. The caller also verifies payment and fulfillment before posting points. These functions neither post journal entries nor confirm a payment.

## Service windows and lifecycle

`serviceDates` validates calendar dates and returns arrival-inclusive, departure-exclusive dates. It uses UTC only to enumerate calendar days, avoiding daylight-saving arithmetic. It supports 1 to 366 nights and deliberately does not reject past dates: the API must check dates against the venue's current local date.

`allowedTransition` checks whether a state/action pair is allowed. It does not check actor permissions, provider payment, hold expiry or database revisions. Those checks must occur in the caller's transaction. Expired, cancelled, fulfilled and payment-review states cannot be revived through this helper.

## Demand rules

`assessDemand` validates nonnegative event/capacity counts up to one billion, an ISO UTC observation time, an optional source-period start, and an explicit occupancy, revenue or balanced goal. Default readiness requires at least 20 recorded events and nonzero capacity. The evidence preserves counts and the supplied source window; a missing start remains `null`.

Recorded observations may include several events from the same customer. The confirmed/search ratio is an event-count ratio, not a measured customer conversion cohort. Readiness means the deterministic rule has enough configured input events to run. It does not establish statistical accuracy or forecast quality.

Every recommendation includes its reason and `demand-rules-v1`. Commercial suggestions require approval. No confidence score, future revenue or automatic price change is invented. The API must supply counts from an authorized, consistent query and revalidate any approved effect against current inventory and policy.
