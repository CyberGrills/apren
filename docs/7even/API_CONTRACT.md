# 7even API contract

Approved product scope and fee rules: user confirmation on 16 October 2026. These routes describe the rebuilt local server. Shared DTOs and strict input schemas live in `packages/contracts/src/index.ts`; account recovery schemas live beside their handlers in `services/platform/src/accounts.ts`.

All routes start with `/api`. Success is `{ data: T }`; list data is an array, without a total-count envelope. Errors use `ApiErrorBody`. Amounts are exact integer minor-unit strings, points are bounded integers. App mutations use same-origin verification and, for a signed-in actor, CSRF verification. The business mutations below require `Idempotency-Key`; login, registration, recovery, password change and webhook handlers have separate controls. Session authority comes from the server cookie. Browser requests include credentials. `X-CSRF-Token` comes from the session response. Never accept a caller-supplied role or business as authority.

| Method and path | Input | Data | Access |
|---|---|---|---|
| GET /health/live, /health/ready | None | `{ status, ... }` | Public, readiness checks storage |
| GET /auth/session | None | SessionData | Public, returns null user when anonymous |
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
| POST /reservations/:id/checkout | None | Checkout | Owning customer or scoped reception for walk-in |
| GET /payments/:id | None | Payment | Owning customer, scoped business, admin |
| POST /payments/verify | paymentVerifyInput | Payment | Owning customer or scoped staff; server re-query |
| POST /payments/:id/dev-complete | `{ outcome: 'SUCCESS' | 'FAILURE' }` | Payment | Owning actor; ONLY mock mode and nonproduction |
| POST /webhooks/flutterwave | Provider raw payload | acknowledgment | Explicit v3 shared-hash protocol, durable inbox, independent verification |
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
| POST /admin/businesses/:id/status | businessStatusInput | Business | Admin, audited |
| POST /admin/businesses/:id/subaccount | subaccountInput | Business | Admin, verify mapping with provider before live activation |
| POST /admin/policy | policyInput | AdminOverview policy | Admin, immutable next version; commission fixed approved1000bps |
| POST /admin/reconcile | None | `{ processed, pending, exceptions }` | Admin, bounded existing attempts/settlements/refunds, no blind financial retry |
| POST /admin/provider-events/:id/retry | `{ reason }` | `{ success: true }` | Admin, audited, unprocessed and unleased event only |
| GET /admin/operations | None | AdminOperations | Admin, inbox/outbox counts, sync sources and reward moderation records |
| POST /admin/sources/:id/status | sourceStatusInput | `{ success: true }` | Admin, audited; activation requires active user and membership |
| POST /admin/rewards/:id/moderation | rewardModerationInput | Reward | Admin, audited; publishing requires an approved business |

`mock` is a local test-provider double, visibly labelled in the UI and forbidden in production. Its completion route must run the same verification and transaction path as provider-confirmed events. A local completion is not Flutterwave sandbox evidence. The checkout URL in mock mode is `/checkout/test/:paymentId`; frontend provides the clearly labelled local test checkout. Real mode uses the verified Flutterwave-hosted URL from the backend. No provider secret enters the browser.

Normal state flow is `HELD -> CONFIRMED -> CHECKED_IN -> FULFILLED`, with cancellation and expiry transitions constrained by policy. Payment success after a hold is expired or unavailable records an actual receipt but yields `PAYMENT_REVIEW` and no capacity claim. Payment, settlement, refund and reward state are separate. Repeated fulfillment issues points once. Every actual duplicate payment is recorded financially; only one payment may fund the reservation, and extra payments enter refund review.

Baseline development data is explicit and labelled: sample Nigerian hospitality businesses across STAY/DINING/EXPERIENCE, upcoming capacity, representative reservations, and roles. Seed requires development/test mode and explicit invocation. Production startup never silently creates sample records or default logins. Development seed credentials are environment supplied or securely generated and shown only during local seed. Local verification uses private fixture credentials, never production credentials. Synthetic observations are retained with their provenance and excluded from measured demand suggestions.
