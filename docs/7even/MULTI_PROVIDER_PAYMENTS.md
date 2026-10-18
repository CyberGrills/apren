# Multi-provider payments

Implementation brief, Integrated into `main` on 18 October 2026 (merge commit `a4f33ae`, based on the 7even rebuild already present in main). The payment implementation is in the unified system; it is not approval to move real funds or deploy. Provider sandbox evidence, independent review and the release gates below still apply.

## Agreed behavior

- Route the immutable NGN payable total, including stated taxes, to Paystack at or below 5,000,000 kobo. Strictly above that amount uses Flutterwave. No automatic live-provider fallback.
- Customers can instead choose native USDC on Base. All quoted tokens go directly to the approved business wallet. Record 7even's 10% discounted-service commission as an NGN receivable, never as cash collected.
- Fiat processors deduct their actual fees from the business share. Crypto adds no platform processing fee. The customer approves the wallet's ETH network fee before sending.
- Retain the accepted quote, payment route, execution mode, provider account revision and destination throughout retries and recovery.

## Financial invariants

1. Every NGN journal balances. Crypto token quantities use integer atoms with explicit chain, contract and six-decimal precision; they never pass through the two-decimal fiat parser.
2. One durable checkout intent per reservation. Repeated calls reuse it; a caller cannot switch methods after initialization to create competing payable intents.
3. Transaction, refund, inbox and journal identities are provider-scoped. Provider identity comes from the saved attempt and authenticated endpoint, never a client success claim.
4. Only independent server verification changes funding status. Duplicate, out-of-order and wrong-provider evidence has no repeated financial or rewards effect.
5. Pending, failed, successful, uncertain and review outcomes stay distinct. Unknown external dispatch is reconciled, never blindly repeated.
6. Late or mismatched transfers remain visible without reviving released inventory. Points still require verified payment and completed service.
7. Crypto commission owed is a receivable, not a business bank payable or platform cash receipt. Corrections and refunds use compensating entries.
8. Authorization, tenant and venue restrictions apply to every options, checkout, proof, payment, destination and refund operation.

## Data and interfaces

Add a checksummed migration with provider lookups; provider-specific approved business payment accounts; persisted provider/method/policy and receipt journal references; composite receipt/refund/event uniqueness; immutable crypto quotes and verified transfer evidence. Backfill existing Flutterwave/mock attempts and original journal references without modifying historical journals. New tables inherit the existing owner/application/read-only grant pattern and retain financial records.

Use a provider registry resolved from each saved attempt. Keep existing injected test doubles compatible. Add the Paystack adapter with integer-kobo initialization, fixed engine commission, subaccount fee bearer, raw HMAC-SHA512 webhook authentication, server verification and normalized refunds. Preserve the Flutterwave adapter. Paystack transaction success alone is not proof of bank settlement; insufficient settlement evidence remains pending review.

Crypto checkout locks an indicative NGN-per-USDC rate fetched server-side, source/retrieval time, exact rounded-up token atoms, payer, approved destination, network, native token contract, expiry and a unique wallet challenge. Require a signature proving payer control before accepting a public transaction hash. Verify canonical receipt, exact ERC-20 transfer, chain, token, sender, recipient, inclusion after quote creation, inclusion before quote expiry and finalized block evidence. A pending chain result is not a paid booking. Allow a bounded confirmation hold for crypto so normal L1 finality can complete; expired finality remains an explicit review case. Direct-wallet refunds require a merchant-originated verified return transfer, never a platform private key or fabricated provider refund.

Read-only payment options precede initialization. All customer/reception checkout entry points use one payment-method dialog. Hosted fiat destinations are allowlisted separately by provider. Crypto checkout shows token, Base network, full destination, frozen NGN equivalent, expiry, commission arrangement and wallet network-fee disclosure. Business/admin views show provider accounts, wallet approval, settlement kind and commission owed. Errors and successes use existing popup feedback.

## Verification acceptance

- Routing boundaries: 4,999,999 / 5,000,000 / 5,000,001 kobo; frozen route on retry and after configuration changes.
- Concurrent duplicate checkout, cross-provider matching IDs, forged/raw-body-altered/replayed events, delayed and out-of-order receipt delivery.
- Provider timeout after acceptance, restart, worker termination and database rollback; no repeated initialization or refund.
- Refunds reverse the saved original journal, including pre-migration references. Missing bank evidence never claims bank delivery.
- Exact crypto conversion and decimal bounds; invalid/wrong chain/token/wallet/amount; insufficient finality; expired/old transaction; wallet-signature theft; transaction reuse; pending-to-final restart recovery; direct refund proof and commission reversal.
- Restricted-runtime migrations/API tests, cross-user and cross-business access, responsive checkout, keyboard/focus and mock/live labels.
- Existing unit/integration suites, typecheck, lint and build. Provider sandboxes and Base Sepolia checks need configured test accounts/RPC/wallets. No real funds are used by automated acceptance tests.

## Sources and release limits

[Paystack transaction API](https://paystack.com/docs/api/transaction/), [splits](https://paystack.com/docs/payments/split-payments/), [webhooks](https://paystack.com/docs/payments/webhooks/), [refunds](https://paystack.com/docs/api/refund/), [settlements](https://paystack.com/docs/api/settlement/), [Circle token addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Coinbase indicative exchange rates](https://docs.cdp.coinbase.com/coinbase-app/track-apis/exchange-rates), [Base finality](https://docs.base.org/base-chain/specs/protocol/consensus/derivation).

Provider account enablement, approved bank/wallet ownership, actual bank settlement, testnet wallet delivery, real SMTP, operational alerts and qualified financial/security review remain release requirements. Indicative FX data is an agreed checkout valuation, not a conversion or guaranteed redemption service. 7even never holds wallet seed phrases or signs business transfers.
