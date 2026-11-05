# 7EVEN Creator & Artwork API Contract — Amendment

**Status:** Proposed clarification to `CREATOR_ARTWORK_API_CONTRACT.md`  
**Applies to:** Campus Connect Phase 2 creator onboarding and artwork submissions  
**Scope:** Contract clarification only. No API, database, storage, authentication or production implementation.

This amendment is to be read together with the main Creator & Artwork API Contract. Where this amendment is more specific, it takes precedence.

## 1. Approval makes artwork public

**Decision:** A moderator's successful `APPROVED` decision makes the artwork public immediately. There is no separate publish button or implicit creator-side publication step.

On approval, the backend must atomically:
1. Verify the creator profile is `VERIFIED` and active.
2. Verify all required rights, attribution and community permissions have been reviewed and cleared.
3. Verify all attached media is complete and passed server-side validation.
4. Record the moderator decision and immutable audit event.
5. Set the artwork's public availability and publication timestamp.
6. Make the artwork eligible for public creator profile and Art & Culture discovery responses.

If any condition fails, the review decision must not expose the artwork publicly. Return a stable error code and preserve the submission for moderator follow-up.

The public discovery endpoints must return only records satisfying all publication gates. A creator must not be able to publish by changing client state or calling a public endpoint.

### Mandatory warning and confirmation

Show this warning to creators immediately before submitting artwork for review:

> **Important: approval makes this artwork public.** If a moderator approves it, the artwork will become visible on your public creator profile and in 7EVEN Art & Culture discovery. Do not submit private, confidential, restricted, sacred or community-owned material unless you have the necessary rights and permissions. Public display does not transfer copyright or ownership, but people will be able to view the approved work and its public attribution/licence details.

Require an explicit, unchecked confirmation:
`I understand that moderator approval will make this artwork publicly visible.`

The backend must require a corresponding boolean confirmation in the submission request, e.g. `confirmPublicVisibility: true`, and reject missing/false values. This confirmation supplements, and does not replace, rights and permission declarations.

Show a corresponding moderator warning in the review interface:

> **Approval publishes this artwork immediately.** Confirm creator verification, rights evidence, attribution, cultural permissions, media validation and any display restrictions before approving.

The review decision endpoint remains `POST /admin/creator-submissions/:submissionId/review`. A successful `APPROVED` response must include `publishedAt` and `publicUrl` (or an explicitly documented equivalent). The response must not imply approval if publication gates fail.

## 2. Idempotency contract

Backend must confirm and document the platform's canonical idempotency mechanism before frontend mutation integration. Until confirmed, the frontend must not invent a header name or retry non-idempotent mutations automatically.

Required behavior:
- Mutating requests that create a resource or trigger a consequential transition must accept the platform's canonical idempotency key.
- The key is scoped to the authenticated actor and operation/route.
- Repeating the same key with the same normalized request returns the original outcome without creating duplicate profiles, artworks, upload intents, submissions, review decisions or audit events.
- Reusing a key with a different request body returns a stable conflict error (proposed `IDEMPOTENCY_CONFLICT`).
- The server must persist/recover the outcome sufficiently to handle a client timeout after the server committed the operation.
- A retry after an unknown network outcome must reuse the same key and payload. A new intentional user action uses a new key.
- Upload binary transfer retries are governed by signed-upload expiry and storage-provider semantics; obtain a fresh upload intent when the prior intent expires.
- Review decisions must be concurrency-safe. A second conflicting decision must not overwrite the first; return the authoritative current state and a stable conflict response.

Backend owner must specify the exact header, key format/length, retention window, request fingerprinting rules and error envelope in the shared API contract. Frontend implementation is blocked until these are confirmed.

## 3. Artwork media management

Add creator-owned media operations to the artwork API:
- `PATCH /creator/artworks/:artworkId/media/:mediaId` — update caption and accessibility text.
- `POST /creator/artworks/:artworkId/media/reorder` — set the complete ordered list of media IDs; server verifies every ID belongs to this artwork.
- `PUT /creator/artworks/:artworkId/media/:mediaId/cover` — set one completed media item as the cover; server guarantees at most one cover.
- `DELETE /creator/artworks/:artworkId/media/:mediaId` — remove media from an editable draft or changes-requested submission.

These operations are permitted only while the artwork is in `DRAFT` or `CHANGES_REQUESTED`. Pending-review and approved records cannot be silently mutated. Removing the last required media item clears submission readiness. Every operation enforces creator ownership, validates media state and is audited. Reordering must be deterministic and reject duplicate, missing, foreign or incomplete media IDs.

## 4. Withdrawal, takedown and suspension

Define an authenticated creator action:
- `POST /creator/artworks/:artworkId/withdraw` — request withdrawal of the creator's artwork from public display.

Define a moderator/admin action:
- `POST /admin/creator-submissions/:submissionId/takedown` — immediately suspend public display pending or following a rights, safety, permission or policy investigation.

For a published artwork, an accepted withdrawal or takedown must remove it from public discovery and public creator pages promptly, invalidate or expire public delivery paths as supported by the storage/CDN architecture, and create an immutable audit record. The original submission, evidence and review history remain private and retained according to the platform's approved retention policy.

A takedown must support a reason code, internal moderator rationale and an optional creator-visible explanation. Do not expose private investigation notes or reporter identity to the creator. Define restoration only through a new audited moderator decision after the issue is resolved.

## 5. Revised integration gate

Frontend integration remains blocked until backend confirms:
1. Immediate public visibility on `APPROVED` and the required publication gates.
2. Creator and moderator warning/confirmation behavior.
3. Canonical idempotency header, scope, retention and conflict behavior.
4. Media edit, reorder, cover and removal operations.
5. Withdrawal/takedown routes, public unlisting behavior and audit/retention policy.
6. Canonical response DTOs, error codes and contract tests for all above.

No frontend should claim an artwork is saved, submitted, approved or public unless the backend returns the authoritative persisted state. No sample or placeholder artwork may be represented as a real published creator submission.
