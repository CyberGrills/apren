# Multi-provider payment verification

18 October 2026. Multi-provider payment code was merged into `main` by `ec1ed67`; PostgreSQL integration CI was added in `0a6fb86`. This verification log includes refreshed dependency checks for source commit `a672e59`. It is not approval to move real funds or deploy.

## Accepted behavior

| Choice | Route and destination |
|---|---|
| Fiat payable total at or below ₦50,000 | Paystack hosted checkout, approved business subaccount |
| Fiat payable total strictly above ₦50,000 | Flutterwave hosted checkout, approved business subaccount |
| Native USDC on Base | Exact quoted tokens to the approved business wallet |

The threshold includes stated taxes. Commission is 10% of discounted service before separately stated taxes. Fiat provider fees come from the business share. Direct USDC sends the entire token amount to the business and records NGN commission owed; it never claims 7even received crypto commission. The customer pays Base network gas in ETH. Checkout estimates execution gas before opening the wallet and tells the customer to review the wallet's final fee, including additional network costs.

## Implemented boundaries

Migration 009 preserves original receipt journals and backfills historical provider identities. New attempts freeze route, method, execution mode, account revision and destination. NGN kobo and USDC atoms remain exact integers. Provider-scoped receipt identities, transactional journals and a shared transfer claim prevent duplicate accounting and reuse between a crypto payment and return.

Raw Paystack HMAC authentication precedes durable webhook admission. The server independently queries fiat outcomes. Crypto requires quoted payer ownership and exact native-token transfer evidence on the configured chain, with canonical finalized inclusion within the quote period. Pending and uncertain outcomes recover from saved identities. Refunds compensate original journals; merchant wallet returns must reach the original payer. Contradictory completed refund observations preserve delivery and appear in admin review.

Paystack settlement reports are bounded, redacted observations. They cannot establish bank destination or transaction-level split net, so this implementation keeps bank delivery pending or flagged for independent reconciliation. The final bounded claim records exhaustion before an external lookup, preserving visibility after a crash. No invented settlement postings or bank confirmation are written.

## Browser evidence

Saved captures are in [the payment verification folder](../../design/explorations/verification/payments/). Real local browser checks covered:

- Paystack selection for ₦23,650 and Flutterwave selection for ₦70,950, including success and failed-payment popups.
- Payment method selection, cancellation, USDC confirmation and the merchant return popup. All financial effects used explicit local doubles; no tokens, gas or bank funds moved.
- A local USDC payment and full return, with commission owed changing from ₦2,200 to ₦0 in admin.
- Phone width 390 CSS pixels for the payment choice, crypto detail page and refund success popup, with no document-level horizontal overflow. Long addresses wrap; operational tables retain internal scrolling.
- Escape closes the fresh reservation payment dialog and restores focus to its current Continue to payment button. Busy actions remain guarded. Browser error/warning log inspection returned no entries for the final session.

The existing green/ivory/sand brand and native dialog patterns were retained, informed by the installed UI reference catalog. No hosted design generation or new visual library was used. These are selected desktop/phone checks, not a full device or assistive-technology audit. The actual connected-wallet review requires external wallet testing.

## Checks and remaining release evidence

| Fresh command | Result | Saved output |
|---|---|---|
| Current GitHub Actions validation after hotel-engine refactor | 240 unit tests passed; PostgreSQL integration: 168 passed, 1 skipped, zero failed | [CI run](https://github.com/CyberGrills/apren/actions/runs/39269165055) |
| `npm run test:integration` | Original feature-branch PostgreSQL baseline: 169 passed, zero failed or skipped. GitHub Actions now provisions PostgreSQL 16 and reruns the integration suite on every PR; current dependency-review PR checks that same suite. | [PostgreSQL/provider integration](evidence/payments-integration.txt) |
| `npm run build` | Typecheck and production build passed on Node.js 24.22.0; 547.39 kB main JavaScript chunk retains its size warning | [Build](evidence/payments-build.txt) |
| `npm run lint` | Exit 0, no errors; 187 warnings and 4 information diagnostics | [Lint](evidence/payments-lint.txt) |
| `npm audit --json` | Exit 0, zero known advisories across the reported 182 dependencies | [Dependency audit](evidence/payments-dependency-audit.json) |
| `git diff --check` | Passed | Local diff check |

The linked GitHub Actions run is the current automated verification. Remaining attached command outputs are snapshots from earlier commits and are not the current release gate. A clean `npm ci` succeeded against the regenerated package lock under Node.js 24.22.0. The updated lock preserves registry URLs and integrity hashes for installed packages. Zod is aligned at 4.6.7 for `packages/contracts` and `services/platform`, both of which import it directly. The root test toolchain also declares Zod as a dev dependency because `tests/integration/accounts.test.ts` imports it from the repository root; this prevents npm 11 from relying on an optional peer dependency to expose the module. `apps/web` continues to use the root overrides for transitive `nanoid` and `source-map-js` rather than duplicating them as direct workspace dependencies.

A source-scope manifest was previously generated for commit a672e59512b57251ca9549ba3debbdf131b1942c. That snapshot predates the current 7even hotel-booking consolidation and was removed from the current tree so it cannot be mistaken for a manifest of the current source. Regenerate a source manifest from the exact release commit before release review. The existing injected-provider tests do not certify live payment delivery, settlement, refunds or wallet transfers.

A limited offline check inspected 111 active source/migration/test files for long live Paystack keys, Flutterwave test keys and private-key headers, finding no matching file. This is a narrow pattern check, not a complete secret scan.

The remaining attached command outputs record earlier totals and warnings. PostgreSQL tests use an isolated database and a restricted runtime login. They cover concurrent initialization, immutable destinations, raw webhook forgery/replay, provider identity collisions, signature and network boundaries, canonical finality, refunds after points spending, recovery caps, concurrent transfer claims, conflicting delivered refunds, actual process termination and database rollback. Provider and RPC responses are synthetic.

The browser wallet tests reproduced a library fallback that issued a second send method after an ambiguous `-32000` error. The implementation now makes one direct `eth_sendTransaction` request per explicit send, freezes the reviewed transaction fields, rechecks account/network, and treats a malformed returned hash as uncertain. Fourteen wallet tests cover the fee estimate, exact calldata and failure paths; no real wallet was connected. Independent agent review found no remaining actionable finding in that fix or the bounded settlement collector. These reviews do not replace qualified release review.

Provider sandbox checkout, split allocation, actual fees, webhook delivery, refunds and bank credit remain unverified. Base Sepolia transfer/return with funded wallets, trusted HTTPS RPC acceptance and real indicative rate behavior also remain external checks. Smart contract wallets are unsupported. The network verification trusts the configured RPC; the rate is indicative, not an executable currency conversion.

Production additionally needs qualified review of financial, authentication and tenant boundaries; safe migration/restore drills; deployed TLS/network controls; abnormal-transaction monitoring; comprehensive secret/static/API security evidence; and applicable payment/privacy review. The limited credential-pattern check and dependency audit are not a security certification. Existing lint warnings and the build chunk-size warning remain visible in attached evidence. No production readiness, merge or deployment is claimed.
