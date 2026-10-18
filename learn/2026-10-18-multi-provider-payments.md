# Three payment paths, one booking record

> 2026-10-18 · Route smaller payments to Paystack, larger payments to Flutterwave, and add direct-wallet USDC.

## In short
7even now chooses the fiat processor from the accepted booking total and also offers native USDC on Base. The saved payment route survives retries, while direct-wallet commission remains money the business owes 7even.

## What changed
- `packages/engine/src/paymentRouting.ts` and its test define the ₦50,000 boundary; `packages/contracts/src/index.ts` defines requests and payment/account responses.
- `services/platform/src/providerRegistry.ts`, `paystackProvider.ts` and `cryptoProvider.ts` resolve adapters, normalize Paystack evidence and verify exact Base transfers.
- `services/platform/src/app.ts`, `paymentAccounts.ts`, `payments.ts`, `store.ts` and `worker.ts` connect authenticated routes, wallet approval, provider-scoped journals, refunds and recovery. `paystackSettlement.ts` saves bounded settlement observations without claiming bank delivery; `seed.ts` supplies labelled mock accounts.
- `database/migrations/009_multi_provider_payments.sql` preserves historical journals, adds provider accounts/quotes/proofs and prevents financial bindings from changing.
- `apps/web/src/components/PaymentMethodDialog.tsx` connects `BookingPanel.tsx`, `BookingList.tsx` and `ReceptionPage.tsx`. `components/ui.tsx` restores focus to the payment button. `App.tsx` and the customer exports expose the crypto route.
- `apps/web/src/lib/paymentWallet.ts`, `CryptoCheckoutPage.tsx`, `BusinessPayments.tsx` and `CryptoRefundDialog.tsx` handle wallet signing, fee review, ownership and merchant returns. Existing payment/admin/business/shared views and `styles/customer.css` show the new states.
- `.env.example`, package manifests/lockfile, README and `docs/7even/` describe configuration and limits. Routing, provider, wallet and PostgreSQL tests cover boundaries and failure paths.

## How it works
1. `fiatPaymentRoute()` sends totals at or below 5,000,000 kobo to Paystack; larger totals use Flutterwave. The caller can choose USDC instead.
2. Checkout locks the reservation, provider, execution mode and approved destination before dispatch. Repeated requests reuse that intent; a read-only resume endpoint opens its saved link without dispatching again.
3. Fiat results are independently queried. USDC freezes a five-minute indicative quote, requires payer ownership, and checks the exact finalized transfer. Confirmation gets a bounded reservation hold.
4. Balanced NGN journals record the result. Direct USDC produces a commission receivable, not platform cash; rewards still require completed service.
5. Refunds reverse original allocations. `verifyCryptoRefund()` checks a merchant-controlled return to the original payer. Contradictory later refund evidence stays visible in admin without changing delivered accounting.

## Why it's built this way
The browser chooses a method, never an arbitrary processor or trusted success result. Integer kobo and token atoms avoid rounding across different units. Frozen destinations prevent a later bank/wallet edit from redirecting an existing payment.

## The concept worth knowing: durable identity
Simply put, a parcel keeps its tracking number even when its delivery is delayed. A timeout does not mean another parcel should be sent.

Precisely, persisted intents, provider-scoped transaction identities and journal references recover the original operation without repeating money movement. Each explicit wallet send makes one raw submission, with no fallback after uncertainty. Its hash or pending guard survives navigation.

## Watch out for
Real provider sandboxes, Base wallet transactions and SMTP delivery remain untested. Paystack charge success does not prove bank settlement. Smart contract wallets are unsupported. Test duplicate requests, wrong networks, expired quotes, delayed finality and restarts; local doubles cannot establish external delivery.

## Check yourself
1. Why does exactly ₦50,000 use Paystack?
   <details><summary>Answer</summary>The rule is strictly above ₦50,000 for Flutterwave; equality belongs to Paystack.</details>

2. Why is direct-wallet commission owed rather than collected?
   <details><summary>Answer</summary>All USDC reaches the business. 7even has a receivable until separately paid, not cash it received.</details>

3. What should happen after a wallet timeout?
   <details><summary>Answer</summary>Recover and verify the original transaction. An uncertain outcome never authorizes sending again.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---
*Made with Edirae Learn · edirae.com*
