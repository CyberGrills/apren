# Revenue orchestration: first bounded engine slice

This is a deterministic decision layer, not a live PMS integration or an autonomous campaign sender.

## Flow
1. Observe a funnel event and timestamped inventory snapshot.
2. Reject missing/stale inventory and request a refresh.
3. Recommend a bounded next action from explicit rules.
4. Require human approval for promotions and high-value proposals.
5. Allow guest contact only when marketing consent is present.
6. Calculate net revenue contribution in integer minor currency units. This arithmetic is not causal incrementality: do not describe it as recovered uplift until a pre-defined baseline or randomized/credible holdout comparison is persisted and reconciled.

## Inventory authority
The PMS or authorized channel manager remains the source of truth. āprən must not create room inventory. The initial freshness windows (PMS 5 minutes; other trusted sources 2 minutes) are conservative implementation defaults that must be validated against partner SLAs, not claimed industry standards.

## Not yet connected
This function does not connect to Cloudbeds, SiteMinder or OHIP; persist funnel events; send WhatsApp/email; change rates; create reservation holds; or write to inventory. It must be wired to authenticated, consent-aware event ingestion and provider adapters before production use. Human approval remains required for rate/campaign changes.
