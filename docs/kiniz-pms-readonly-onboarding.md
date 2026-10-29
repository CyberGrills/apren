# Kiniz read-only PMS/channel-manager onboarding

**Status: BLOCKED — provider, authorization, credentials and external property mapping are unconfirmed.**

Kiniz's website is under construction. That does not establish a PMS provider, API access, current rates, room inventory or partner approval. Do not publish rates or mark rooms bookable from directory content or synthetic fixtures.

## Required before vendor adapter work

1. **Identify the system of record.** Ask Kiniz's owner or authorized manager which PMS/channel manager currently holds room types, rate plans and nightly availability. Do not assume Cloudbeds, SiteMinder, STAAH or another vendor.
2. **Confirm authority in writing.** Obtain written permission to access the property's inventory through the selected provider. Record permitted purposes, fields, environment, expiry and revocation contact.
3. **Obtain vendor-approved test access.** Prefer a sandbox/test property and least-privilege credentials. Keep credentials in server-side secrets; never commit them, return them to browsers, log them, or copy them into PRs.
4. **Map the property.** Verify the provider's external property ID with the authorized Kiniz contact.
5. **Agree on the read contract.** Confirm documented endpoints/scopes for property, room types, rate plans, nightly availability, restrictions, cancellation policies, currency, source-updated timestamp and rate limits. Read operations only.
6. **Reconcile with the operator.** Confirm room names, occupancy, taxes/fees, dated rates, inventory, restrictions and cancellation terms. An API response alone is not hotel verification.
7. **Test in isolation.** Cover timeout, malformed response, duplicate room/rate IDs, missing timestamps, stale data, zero inventory, rate changes and provider errors. Do not connect fixtures to public search or checkout.
8. **Review before activation.** Keep imported data observation-only until verification and operator sign-off are complete in a separate change.

## Implementation guardrails

- \`services/platform/src/pmsAdapter.ts\` is a provider-neutral contract and validation boundary, not a vendor integration.
- The adapter factory deliberately fails closed; no vendor-specific client is shipped until the provider is confirmed and its documented read API can be implemented accurately.
- Only GET operations are allowed. No inventory/rate writes, reservations, payments, guest messaging or webhook-triggered writes.
- Missing source timestamps are \`UNKNOWN\`, not fresh. Stale and future-dated timestamps are not eligible as current inventory.
- Snapshots are always \`OBSERVATION_ONLY\`; they do not create or publish a hotel listing or establish bookability.
- Do not merge, deploy, change Production data/configuration, or modify \`main\` or \`feat/7even-hospitality-rebuild\` as part of this work.

## Operator evidence checklist

- [ ] Hotel contact and role recorded
- [ ] Written partner authorization stored securely
- [ ] PMS/channel-manager vendor and product version confirmed
- [ ] Sandbox/test access approved
- [ ] Server-side secret configured in isolated Preview environment
- [ ] External property ID verified with Kiniz
- [ ] Room types and occupancy confirmed by operator
- [ ] Rates, currency, taxes/fees and nightly availability confirmed
- [ ] Restrictions and cancellation terms confirmed
- [ ] Source timestamp semantics and rate limits documented
- [ ] Staleness, timeout and malformed-response tests pass
- [ ] Hotel/operator signs off before any future bookability change
