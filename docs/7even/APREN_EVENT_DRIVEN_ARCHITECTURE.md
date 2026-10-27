# āprən Architecture: Event-Driven, Measured, Risk-Bounded

**Reference:** [Inside a Real High-Frequency Trading System — HFT Architecture](https://youtu.be/iwRaNYa8yTw)

## What we are borrowing

The video describes a pipeline that ingests changing market data, maintains a current state, publishes ordered events, makes bounded decisions, applies risk checks before execution, records every outcome, and monitors latency and failures. āprən should borrow those *system-design principles* for hospitality demand and booking recovery—not the financial-trading business model or hardware-specific optimizations.

## Target flow

```text
Hotel PMS / channel manager / verified partner updates
        ↓
Adapters + schema validation + source timestamps
        ↓
Canonical inventory state + freshness / provenance
        ↓
Versioned events (availability, rate, search, quote, booking outcome)
        ↓
Bounded retrieval → deterministic opportunity ranking
        ↓
Policy / consent / availability / price / idempotency checks
        ↓
Approved recovery route or booking handoff
        ↓
Outcome ledger + reconciliation + incremental-revenue measurement
        ↘
         Metrics, alerts, replay and controlled learning loop
```

## Required properties

1. **Truth before speed.** Every bookable room/rate needs a source, observed-at time, confirmation status and expiry/freshness policy. Directory leads and sample listings remain non-bookable. Stale or unconfirmed inventory fails closed.
2. **Fast read model, durable source of truth.** Keep hot search projections optimized for reads, but reconcile them against partner/PMS truth. Do not treat a cache or in-memory view as authoritative inventory.
3. **Event-driven, not request-chain fragile.** Emit versioned domain events for inventory changes and booking funnel milestones. Consumers must tolerate retries, duplicates, delayed delivery and out-of-order events.
4. **Deterministic baseline first.** Use bounded candidate retrieval, deterministic ranking and explainable recovery rules. Record why an opportunity was selected. No learned optimizer until baseline events, parity tests and outcome labels are trustworthy.
5. **Pre-action risk gate.** Before any customer-facing recovery or booking commit, validate authorization/consent, current availability, rate version, booking terms, idempotency key, route policy and limits. Uncertain state means no automated commit.
6. **Explicit execution state machine.** Track attempted, accepted, confirmed, rejected, expired, cancelled and reconciled outcomes. A payment/booking provider response is not equivalent to a confirmed reservation until its contract says so.
7. **Closed-loop measurement.** Correlate search → result → selection → quote → attempt → confirmation/cancellation → net revenue. Separate gross recovered value from net incremental revenue, fees, cancellations and control-group baseline.
8. **Latency and reliability budgets.** Track p50/p95/p99 by stage, candidate counts, stale-inventory rejection rate, error rate, retry volume, queue lag and reconciliation drift. Optimize measured bottlenecks instead of introducing specialized infrastructure prematurely.
9. **Safe degradation.** If an adapter, ranking service or recovery route is unhealthy, fall back to read-only discovery or manual review. Never convert uncertainty into an invented rate or booking.
10. **Auditable learning loop.** Preserve decision inputs, policy version, ranking reason and outcome events with appropriate privacy controls. Run proposed learned strategies in shadow mode, compare against the deterministic baseline, and roll out only with evidence and rollback controls.

## Implementation order

### Phase 1 — Establish reliable state
- Confirm production database connectivity and current inventory counts.
- Select and validate the first PMS/channel-manager integration with Kiniz; do not assume Cloudbeds, SiteMinder or STAAH until partner evidence supports it.
- Define canonical property, room/rate, availability window, source, freshness and confirmation fields.
- Keep unverified/sample inventory visibly illustrative and non-bookable.

### Phase 2 — Event and measurement foundation
- Define versioned, idempotent events for the booking funnel and inventory updates.
- Add an append-only outcome ledger and reconciliation checks.
- Add synthetic tests for stale rates, duplicate webhooks, timeouts, availability changes, cancellations and partial failures.

### Phase 3 — Bounded decision engine
- Benchmark keyset/batched retrieval beyond 1,000 candidates.
- Prove ranking parity and measure p50/p95 before optimizing.
- Keep the deterministic optimizer explainable; log candidate exclusions and route choices.

### Phase 4 — Controlled recovery
- Add policy/risk checks and a dry-run mode first.
- Use a virtual pilot with synthetic inventory and sandbox integrations only.
- Measure incremental outcomes against a holdout/control group before claiming recovered revenue.

### Phase 5 — Shadow learning
- Train/evaluate only from validated events and reconciled outcomes.
- Compare proposed decisions with the deterministic baseline without executing them.
- Require explicit thresholds, rollback and human review before controlled rollout.

## Non-goals

- Do not implement FPGA/kernel-bypass or nanosecond timing: hotel integrations and partner response times dominate the latency budget.
- Do not add a speculative microservice, event broker or in-memory database without a measured need.
- Do not automate live bookings, charges, refunds or customer outreach during the virtual pilot.
- Do not claim real-time availability unless the partner integration actually supports it and freshness is verified.

## First operating dashboard

| Signal | Why it matters |
| --- | --- |
| Inventory count by source and confirmation state | Prevents directory leads from masquerading as bookable hotels |
| Freshness age and stale rejection rate | Shows whether search results are trustworthy |
| Search/quote latency p50, p95, p99 | Identifies actual bottlenecks |
| Candidate count and retrieval truncation | Detects hidden ceilings and incomplete search |
| Funnel conversion by stage | Shows where bookings are lost |
| Confirmation, cancellation and reconciliation drift | Prevents false success reporting |
| Net incremental revenue vs. control | Tests whether recovery creates value rather than merely taking credit for existing demand |

This document is an engineering direction and release checklist, not evidence that the described components already exist in production.
