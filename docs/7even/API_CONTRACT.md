# 7even API contract

Updated 21 October 2026 for optional stay search and the consolidated application. These routes describe the local server. Shared DTOs and strict input schemas live in `packages/contracts/src/index.ts`; account recovery schemas live beside their handlers in `services/platform/src/accounts.ts`.

All routes start with `/api`. Success is `{ data: T }`; list data is an array, without a total-count envelope. Errors use `ApiErrorBody`. Amounts are exact integer minor-unit strings, points are bounded integers. App mutations use same-origin verification and, for a signed-in actor, CSRF verification. The business mutations below require `Idempotency-Key`; login, registration, recovery, password change and webhook handlers have separate controls. Session authority comes from the server cookie. Browser requests include credentials. `X-CSRF-Token` comes from the session response. Never accept a caller-supplied role or business as authority.

| Method and path | Input | Data | Access |
|---|---|---|---|
| GET /health/live, /health/ready | None | `{ status, ... }` | Public, readiness checks storage |
| GET /auth/session | None | SessionData | Public, returns null user when anonymous |
| POST /ai/interpret-search | `{ message: string }`, 2–2000 characters | `{ intent, searchParams, provider: "openai", model }` | Public with same-origin/CSRF checks; 20 attempts per IP per 15 minutes in PostgreSQL; requires server key and explicit model |
| POST /auth/register | registerInput | SessionData | Anonymous; CUSTOMER only |
| POST /auth/login | loginInput | SessionData | Anonymous, rate limited |
| POST /auth/logout | None | `{ success: true }` | Session |
| POST /auth/recovery | `{ email }` | `{ message }` | Generic account-independent response, persisted IP/email limits; production delivery must be configured |
| POST /auth/recovery/complete | `{ token, password }` | `{ success: true }` | Single-use unexpired token, persisted IP limit, revokes previous sessions and recovery links |
| POST /me/password | `{ currentPassword, newPassword }` | `{ success: true }` | Self, current password and CSRF, persisted limits, revokes sessions and links |
| PATCH /me | profileInput | SessionUser | Self |
| GET /offerings | city, kind, startDate, endDate, page/pageSize | Offering[] | Published approved businesses only |
| GET /offerings/:id | None | Offering | Public published or owning business/admin |
| POST /quotes | quoteInput | Quote | Customer or authorized reception walk-in flow |
| POST /reservations | reservationInput | Reservation | Customer, atomically hold capacity |
| GET /reservations/:id | None | Reservation | Customer self, scoped staff, admin |
| POST /reservations/:id/actions | reservationActionInput | Reservation | Customer CANCEL subject to policy; scoped staff operations |
| GET /reservations/:id/payment-options | None | PaymentOptions | Reservation access; read-only provider availability, network and existing payment |
| POST /reservations/:id/checkout | `{ method, payerAddress? }` (FIAT or USDC_BASE) | Checkout | Owning customer or scoped reception; crypto requires paying wallet; caller cannot select fiat provider |
| GET /payments/:id | None | Payment | Owning customer, scoped business, admin |
| GET /payments/:id/checkout | None | Checkout | Reservation access; resumes the saved link without dispatch or a mutation key; unresolved/recorded outcomes return 409 |
| POST /payments/verify | paymentVerifyInput | Payment | Owning customer or scoped staff; server re-query |
| POST /payments/:id/dev-complete | `{ outcome }` (SUCCESS or FAILURE) | Payment | Owning actor; ONLY mock mode and nonproduction |
| POST /payments/:id/crypto-refund | `{ transactionHash }` | Payment | Scoped owner/admin; verify merchant return for an existing refund intent |
| POST /payments/:id/dev-refund-complete | `{}` | Payment | Scoped owner/admin; explicit mock crypto return only, nonproduction |
| POST /webhooks/flutterwave | Provider raw payload | acknowledgment | Explicit v3 shared-hash protocol, durable inbox, independent verification |
| POST /webhooks/paystack | Provider raw payload | acknowledgment | HMAC-SHA512 over exact raw bytes using server secret; provider-scoped inbox and independent verification |
| POST /reservations/:id/refunds | `{ reason: string, paymentId?: string }` | Payment | Scoped owner/admin, allowed cancellation/refund policy, unknown outcome never blindly retried |
| GET /me/overview | None | CustomerOverview | Self |
| GET /rewards | None | Reward[] | Up to 100 published, unexpired approved business rewards |
| POST /rewards/:id/redeem | None | Benefit | Customer, atomic points debit and capacity |
| POST /benefits/:id/consume | benefitConsumeInput | Benefit | Issuing business staff/admin only |
| POST /trades | tradeInput | Trade | Current benefit owner; restricted bookings rejected |
| POST /trades/:id/actions | tradeActionInput | Trade | Named counterparty ACCEPT/DECLINE, sender CANCEL |
| POST /notifications/:id/read | None | Notification | Recipient only |
| POST /business/applications | businessApplicationInput | Business | Authenticated customer, becomes pending owner |
| GET /business/overview | None | BusinessOverview | Owner/scoped staff |
| GET /business/payment-accounts | None | `{ accounts, commissionOwedMinor, chainId }` | Business owner, own accounts and crypto commission owed |
| GET /business/payment-wallet-challenge | `address` query | `{ message, revision, expiresAt }` | Business owner; five-minute ownership challenge bound to business, wallet, chain and revision |
| POST /business/payment-wallet | `{ walletAddress, signature, expectedRevision, expiresAt }` | Business | Business owner, exact signed challenge; creates pending wallet review |
| GET /business/venues | None | Venue[] | Owner, active venues in own business |
| POST /business/venues | venueInput | Venue | Owner, own business, audited |
| PATCH /business/venues/:id | venueInput plus expectedRevision | Venue | Owner, own business, revision checked |
| DELETE /business/venues/:id | None | `{ success: true }` | Owner, archives an unused venue; retained offerings and memberships prevent archival |
| POST /business/offerings | offeringInput | Offering | Approved business owner |
| PATCH /business/offerings/:id | offeringInput plus expectedRevision if required | Offering | Owning business owner |
| POST /business/offerings/:id/availability | availabilityInput | Offering | Owning business owner, cannot evict accepted allocation |
| POST /business/rewards | rewardInput | Reward | Approved business owner |
| POST /business/staff | staffInput | SessionUser | Owner, RECEPTION only, no arbitrary role |
| DELETE /business/staff/:id | None | `{ success: true }` | Owner, revokes membership/session access |
| GET /reception/overview | None | ReceptionOverview | Scoped owner/reception |
| POST /reception/walk-ins | walkInInput | Reservation | Scoped owner/reception, same quote/capacity engine |
| POST /reception/sync | receptionEventInput | SyncResult | Session and persisted property-bound source identity |
| GET /reception/reservations/:id/payment-notes | None | PaymentNote[] | Scoped owner/reception or admin |
| POST /reception/reservations/:id/payment-notes | paymentNoteInput | PaymentNote | Same scope, staff observation only; does not establish payment or reward eligibility |
| GET /admin/overview | None | AdminOverview | Admin |
| POST /admin/businesses/:id/status | businessStatusInput | Business | Admin, audited; APPROVED requires all hotel verification checks, evidence references and a 1–168 hour inventory freshness window |
| POST /admin/businesses/:id/subaccount | `{ provider, subaccountCode, accountLabel }` (flutterwave or paystack) | Business | Admin; matching RS_/ACCT_ code and verified Nigerian bank mapping |
| POST /admin/businesses/:id/crypto-wallet/approve | `{ expectedRevision, approved, reason }` | Business | Admin, reviewed current wallet ownership, revision and business status |
| POST /admin/policy | policyInput | AdminOverview policy | Admin, immutable next version; commission fixed approved1000bps |
| POST /admin/reconcile | None | `{ processed, pending, exceptions }` | Admin, bounded existing attempts/settlements/refunds, no blind financial retry |
| POST /admin/provider-events/:id/retry | `{ reason }` | `{ success: true }` | Admin, audited, unprocessed and unleased event only |
| GET /admin/operations | None | AdminOperations | Admin, inbox/outbox counts, sync sources and reward moderation records |
| POST /admin/sources/:id/status | sourceStatusInput | `{ success: true }` | Admin, audited; activation requires active user and membership |
| POST /admin/rewards/:id/moderation | rewardModerationInput | Reward | Admin, audited; publishing requires an approved business |

`Payment` identifies the saved provider, method, execution mode, routing policy version, bank or wallet delivery kind, and `commissionOwedMinor`. Crypto payments additionally expose their frozen quote, payer verification, transaction hash, transfer evidence and merchant refund instructions. `paymentVerifyInput` accepts `{ reference, transactionId?, walletSignature? }`: fiat transaction IDs are numeric strings; Base hashes are 0x-prefixed 32-byte hashes. Crypto requires the exact quote message signed by its recorded payer before transaction proof is accepted. Standard externally owned accounts are supported; smart contract signature validation is not.

`FIAT` routes an accepted total at or below 5,000,000 kobo to Paystack and a total strictly above it to Flutterwave, including stated tax in the comparison. The 10% commission basis remains discounted service before tax. The persisted route, execution mode, amount and approved destination do not change on retries. One reservation has one initialized checkout intent; changing methods afterward is rejected. No live-provider fallback occurs.

`USDC_BASE` sends the entire quoted native USDC amount directly to the approved business wallet. Its 10% NGN service commission is a business receivable, not collected cash. Token atoms and network evidence are separate from NGN journals. Indicative FX quotes last at most five minutes; the reservation hold is extended for up to 60 minutes of final confirmation. The server checks the canonical exact transfer, inclusion window and finalized chain evidence. Wrong, late or unmatched evidence does not revive expired capacity. A crypto refund has payment status `REFUND_PENDING` and refund state `REQUESTED` until the business sends the full token return to the original payer and the server verifies it. The browser never signs on behalf of the business.

`mock` uses labelled local doubles and is forbidden in production. Its completion routes exercise verification without external money or tokens. Fiat mock checkout stays at `/checkout/test/:paymentId`. Crypto stays at `/checkout/crypto/:paymentId`, with explicit local completion controls when mocked. Live fiat redirects allow only the exact HTTPS origins `checkout.flutterwave.com` and `checkout.paystack.com` for their recorded provider. No server secret enters the browser. A local completion does not establish provider sandbox, bank or Base delivery.

Normal state flow is `HELD -> CONFIRMED -> CHECKED_IN -> FULFILLED`, with cancellation and expiry transitions constrained by policy. Payment success after a hold is expired or unavailable records an actual receipt but yields `PAYMENT_REVIEW` and no capacity claim. Payment, settlement, refund and reward state are separate. Repeated fulfillment issues points once. Every actual duplicate payment is recorded financially; only one payment may fund the reservation, and extra payments enter refund review.

Baseline development data is explicit and labelled: sample Nigerian hospitality businesses across STAY/DINING/EXPERIENCE, upcoming capacity, representative reservations, and roles. Seed requires development/test mode and explicit invocation. Production startup never silently creates sample records or default logins. Development seed credentials are environment supplied or securely generated and shown only during local seed. Local verification uses private fixture credentials, never production credentials. Synthetic observations are retained with their provenance and excluded from measured demand suggestions.
