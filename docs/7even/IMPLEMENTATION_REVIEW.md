# 7even Implementation and Release Review

## Scope

This review describes the current 7even implementation. It is an engineering review, not a declaration of production readiness or a substitute for the post-merge CI and deployment checks.

## Product boundary

7even is a Nigeria-first hospitality platform. The active code is organized into four workspaces: the web app, platform API, shared contracts and engine package. The specialized ranking path focuses on hotel stays and uses PostgreSQL listings and room inventory as its source of current availability.

## Hotel-booking optimizer

The 7even-hotel-ranking-v1 policy ranks approved, published STAY listings against the dates, room quantity, location, base-room budget and requested amenities. It excludes candidates that cannot cover every requested night, have expired or ambiguous inventory, lack sufficient room capacity or exceed the base subtotal budget. It returns a checked-at timestamp, 0–100 match score, availability details, estimated base subtotal and human-readable reasons.

The optimizer is deterministic. It does not invent ratings, claim that a trained forecasting model exists or adjust hotel rates. Search results are a point-in-time view. The quote path recalculates the payable amount and reservation transactions lock the inventory again, so a concurrent booking can consume the last room between search and hold.

## Authority and transaction boundaries

- PostgreSQL is authoritative for published listings, availability and reservation/payment state.
- Search optimizes discovery; it does not reserve a room or guarantee that inventory remains available.
- Quote and reservation creation revalidate rates and inventory under server-side transaction controls.
- Provider checkout, bank settlement, blockchain evidence, delivery and refund states remain distinct and require reconciliation where effects are uncertain.

## Verification evidence

The completed PR #14 validation at head 5971b07e7acf65a211bf41d0a68b3da351e566d6 reported:

- Clean dependency install, TypeScript check and production build passed.
- 240 unit tests passed.
- 168 PostgreSQL integration tests passed; one integration case was skipped and there were no failures.

That evidence applies to the referenced engine code revision. Any further source or configuration changes require their own CI run. A passing automated suite proves only the exercised local/injected contracts, not external provider behavior or a live production deployment.

## Release gates still required

Before real-money production use, complete qualified review of authorization, tenant and role boundaries, migration/backup recovery, reconciliation of payment effects, observability, alerting, privacy/legal requirements and the production configuration. Acceptance tests against live payment provider sandboxes, real SMTP delivery and Base wallet transfers are still separate evidence requirements. Do not describe the system as deployed or production-ready until deployment and operational checks are confirmed.
