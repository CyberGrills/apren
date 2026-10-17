# Rebuilding 7even around one hospitality record

2026-10-16 · Rebuild Apren for hospitality and move action feedback into pop-ups.

## In short
7even now connects rooms, dining and experiences to the same reservation, payment and rewards records. The interfaces use shared pop-ups for errors and completed actions, so feedback survives navigation and form closure.

## What changed
- `packages/engine/src/` holds exact pricing, service dates, permitted transitions and measured demand rules. `packages/contracts/src/index.ts` defines shared request validation and response types.
- `services/platform/src/` implements sessions, reservations, verified payments, journals, benefits, reception sync, account recovery and workers. Migrations `001_initial.sql` through `008_sample_observation_provenance.sql` in `database/migrations/` establish their persisted records and constraints.
- `apps/web/src/App.tsx` connects the public, customer and staff routes. `components/Feedback.tsx`, `components/ui.tsx` and `styles/` provide queued native dialogs; page handlers announce confirmed results and clear errors for another attempt. `context/SessionContext.tsx` keeps session authority on the server.
- `apps/web/src/lib/receptionQueue.ts` preserves limited offline actions in IndexedDB. `apps/web/public/sw.js` caches the app shell, while the manifest and logo exports support installation.
- `tests/`, engine/contract tests and `checkout.test.ts` exercise boundaries, races, replay and recovery. Historical Apren files are retained in `legacy/`. The [file guide](../docs/7even/FILE_GUIDE.md) explains every current file and maps every original file.

## How it works
1. A customer or receptionist requests a quote. The server calculates integer kobo and snapshots the accepted terms.
2. A database transaction locks capacity and creates a time-limited hold.
3. Checkout creates a durable provider attempt. The server queries payment evidence before confirming the reservation or posting balanced journals.
4. Completed eligible service earns points once. Redemption checks points and reward capacity together; a transfer rotates the benefit’s ownership code.
5. The interface reports the server result through `FeedbackProvider`. One dialog is shown at a time. Dismissal restores focus, while the underlying record remains available.
6. Workers recover unfinished work. Reception actions stay pending until accepted; conflicts and queue-storage failures open feedback.

## Why it's built this way
Shared contracts keep booking meaning consistent. Database locks protect concurrent work. Sector adapters reuse pure engine rules. Native dialogs contain focus. Session retries enter loading before clearing errors to avoid premature login redirects. Venue-dependent forms wait for venue data.

## The concept worth knowing: idempotency
Think of a parcel tracking number: asking about it repeatedly should refer to the same parcel. Here, an actor’s request key is bound to the operation and payload. A repeated request can recover its recorded outcome. Provider receipts also have unique identities. This prevents repeated processing from creating duplicate effects; it does not promise that a network delivers an event exactly once.

## Watch out for
153 unit tests and 43 database/API tests passed. Build and typecheck passed; lint reports warnings. Flutterwave sandbox, bank settlement and real SMTP remain unverified. The SMTP package download was unavailable. Offline cold start, production recovery drills and qualified financial/access review remain release work.

## Check yourself
1. Why does checkout success in the browser not confirm payment?
<details><summary>Answer</summary>The browser is not authoritative. The server independently verifies the provider record before applying financial effects.</details>

2. What happens if a payment arrives after its inventory hold expires?
<details><summary>Answer</summary>The receipt is retained for review. It cannot recreate inventory that may now belong to another booking.</details>

3. Why does feedback live above the page routes?
<details><summary>Answer</summary>A form may close or navigate after success. Keeping the queue above the page preserves its message until dismissal.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*
