# 7EVEN Creator & African Artworks API Contract

**Status:** Proposed integration contract for backend and frontend review  
**Milestone:** Campus Connect Phase 2 — Creator onboarding and artwork submissions  
**Scope:** Contract only. This document does not implement routes, database tables, storage buckets, authentication changes, or production data changes.

## 1. Contract principles

- All routes are relative to the existing API base and use the existing session-cookie authentication, same-origin checks, CSRF protection, and standard API response envelope.
- Success responses use `{ "data": ... }`. Errors use the platform's existing `ApiErrorBody` envelope; clients must use the existing `api()` helper rather than parsing provider-specific errors.
- Never accept a caller-supplied user ID, role, creator ID, owner ID, approval state, or publication state as authority. Derive the actor from the authenticated session and enforce ownership/role server-side.
- Creator and artwork mutations must be audited. Use the platform's existing mutation/idempotency conventions where applicable; the backend owner must confirm the exact header requirement before implementation.
- Private creator drafts and media remain private. Public routes return only verified creator profiles and approved, publishable artworks.
- No NFT, wallet, blockchain, payment, trading, token, or minting fields or endpoints are part of this contract.
- No fabricated creator, artwork, provenance, ownership, review, or marketplace records may be seeded into production.
- This contract is a proposed DTO and route agreement. Backend engineering must confirm it against the current auth, API middleware, database, storage, and moderation implementation before frontend integration begins.

## 2. Roles and access

| Actor | Allowed access |
|---|---|
| Anonymous visitor | Read published creator profiles and approved public artworks only |
| Authenticated creator | Read and update their own creator profile, drafts, own artwork submissions and review feedback |
| Moderator/admin | Read submissions in the moderation queue and make audited review decisions under the existing admin permission model |
| Other authenticated user | No access to private creator records or unapproved artwork |

A creator profile is not public merely because a user has registered. Public visibility requires the creator profile to be verified and the relevant artwork to be approved and publishable.

## 3. Creator profile

### 3.1 Read the current creator profile

`GET /creator/profile`

Requires an authenticated session. Returns the current user's creator profile, or `null` if onboarding has not started.

Example:

```json
{
  "data": {
    "creator": {
      "creatorId": "creator_opaque_id",
      "slug": "creator-public-slug",
      "displayName": "Creator display name",
      "location": {
        "city": "Uyo",
        "region": "Akwa Ibom",
        "countryCode": "NG"
      },
      "disciplines": ["DIGITAL_ART", "PHOTOGRAPHY"],
      "biography": "Creator-provided biography.",
      "portfolioUrls": ["https://creator.example/portfolio"],
      "profileStatus": "DRAFT",
      "publicProfileUrl": null,
      "createdAt": "2026-11-05T12:00:00.000Z",
      "updatedAt": "2026-11-05T12:00:00.000Z"
    }
  }
}
```

### 3.2 Create or update the current user's profile

`PUT /creator/profile`

Requires an authenticated user. The server associates the profile with the session actor; request bodies must not contain `userId`, `creatorId`, `role`, or status fields.

Request:

```json
{
  "displayName": "Creator display name",
  "location": {
    "city": "Uyo",
    "region": "Akwa Ibom",
    "countryCode": "NG"
  },
  "disciplines": ["DIGITAL_ART", "PHOTOGRAPHY"],
  "biography": "Creator-provided biography.",
  "portfolioUrls": ["https://creator.example/portfolio"]
}
```

Response: `{ "data": { "creator": CreatorProfile } }`.

Validation:
- `displayName`: required, trimmed, 2–80 characters.
- `city`: required, 1–100 characters.
- `region`: optional, up to 100 characters.
- `countryCode`: required ISO 3166-1 alpha-2 code.
- `disciplines`: 1–8 values from the server-supported discipline enum.
- `biography`: required, 30–1,500 characters.
- `portfolioUrls`: up to 5 valid HTTPS URLs; optional.
- Do not collect a public email or phone number by default. Account contact details remain private and are not copied into public profile DTOs.

### 3.3 Submit profile for verification

`POST /creator/profile/submit`

Requires a completed profile. The server validates required fields and moves the profile to `PENDING_REVIEW`. A repeated submission must be idempotent and must not create duplicate review records.

Response: `{ "data": { "creatorId": "...", "profileStatus": "PENDING_REVIEW", "submittedAt": "..." } }`.

Profile statuses:
- `DRAFT`
- `PENDING_REVIEW`
- `CHANGES_REQUESTED`
- `VERIFIED`
- `REJECTED`
- `SUSPENDED`

Only moderators can set verification outcomes. A creator may edit a draft or a profile with changes requested. A verified profile update that materially changes identity or public attribution must return to review; backend must define which fields trigger re-review.

## 4. Creator artwork

### 4.1 List the current creator's artworks

`GET /creator/artworks?status=&cursor=&limit=`

Requires an authenticated creator session. Results are scoped to the session actor.

Supported status filter: `DRAFT`, `PENDING_UPLOAD`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `REJECTED`, `ARCHIVED`.

Pagination: opaque `cursor`; `limit` defaults to 20 and is capped at 50.

Response:

```json
{
  "data": {
    "items": [
      {
        "artworkId": "artwork_opaque_id",
        "title": "Artwork title",
        "discipline": "DIGITAL_ART",
        "status": "DRAFT",
        "coverMedia": null,
        "updatedAt": "2026-11-05T12:00:00.000Z"
      }
    ],
    "nextCursor": null
  }
}
```

### 4.2 Create a draft

`POST /creator/artworks`

Creates a private draft owned by the authenticated creator. Creator profile must exist; the backend may allow a draft while profile verification is pending, but must not allow public publication until creator verification is complete.

Request:

```json
{
  "title": "Artwork title",
  "discipline": "DIGITAL_ART",
  "description": "Creator-written description of the work.",
  "creationYear": 2025,
  "origin": {
    "city": "Uyo",
    "region": "Akwa Ibom",
    "countryCode": "NG"
  },
  "culturalContext": "Creator-provided context and meaning, where relevant.",
  "tags": ["identity", "contemporary"],
  "accessibilityText": "A concise description of the visual work.",
  "rights": {
    "basis": "ORIGINAL",
    "rightsConfirmed": true,
    "attributionText": "Creator's preferred attribution.",
    "thirdPartyPermissions": "Not applicable.",
    "communityPermission": "NOT_REQUIRED",
    "communityPermissionDetails": null,
    "displayLicense": "ALL_RIGHTS_RESERVED"
  },
  "contentNotice": {
    "containsSensitiveCulturalMaterial": false,
    "handlingNotes": null,
    "publicDisplayRestrictions": []
  }
}
```

Response: `{ "data": { "artwork": ArtworkDetail } }`.

### 4.3 Read and update a draft

- `GET /creator/artworks/:artworkId`
- `PATCH /creator/artworks/:artworkId`

Both require creator ownership. `PATCH` is allowed only while status is `DRAFT` or `CHANGES_REQUESTED`; the server rejects edits to pending or approved records unless a separate, audited correction flow is defined.

The response includes the full creator-owned detail DTO and media items. Never return storage credentials or raw private storage paths.

### 4.4 Artwork DTO

The backend should return this stable shape (nullable values are explicit):

```json
{
  "artworkId": "artwork_opaque_id",
  "creatorId": "creator_opaque_id",
  "title": "Artwork title",
  "slug": null,
  "discipline": "DIGITAL_ART",
  "description": "Creator-written description.",
  "creationYear": 2025,
  "origin": {
    "city": "Uyo",
    "region": "Akwa Ibom",
    "countryCode": "NG"
  },
  "culturalContext": "Creator-provided context.",
  "tags": ["identity"],
  "accessibilityText": "A concise visual description.",
  "rights": {
    "basis": "ORIGINAL",
    "rightsConfirmed": true,
    "attributionText": "Creator attribution.",
    "thirdPartyPermissions": "Not applicable.",
    "communityPermission": "NOT_REQUIRED",
    "communityPermissionDetails": null,
    "displayLicense": "ALL_RIGHTS_RESERVED",
    "reviewStatus": "UNREVIEWED"
  },
  "contentNotice": {
    "containsSensitiveCulturalMaterial": false,
    "handlingNotes": null,
    "publicDisplayRestrictions": []
  },
  "media": [],
  "status": "DRAFT",
  "reviewFeedback": [],
  "submittedAt": null,
  "reviewedAt": null,
  "createdAt": "2026-11-05T12:00:00.000Z",
  "updatedAt": "2026-11-05T12:00:00.000Z"
}
```

Supported initial disciplines: `DIGITAL_ART`, `PHOTOGRAPHY`, `FASHION_DESIGN`, `ILLUSTRATION`, `SCULPTURE`, `PAINTING`, `TEXTILE_ART`, `CRAFT`, `HERITAGE_STORY`, `OTHER`. Backend owns the canonical enum and may propose a compatible extension.

Rights enums:
- `basis`: `ORIGINAL`, `LICENSED`, `AUTHORIZED_REPRESENTATIVE`.
- `communityPermission`: `NOT_REQUIRED`, `OBTAINED`, `PENDING`, `NOT_SURE`.
- `displayLicense`: `ALL_RIGHTS_RESERVED`, `CC_BY_4_0`, `CC_BY_NC_4_0`, `OTHER_DOCUMENTED_LICENSE`.
- `reviewStatus`: `UNREVIEWED`, `PENDING`, `VERIFIED`, `REJECTED`.

A creator's declaration is evidence submitted for review, not automatic proof of legal ownership or community consent. If rights basis is licensed or representative, the backend must provide a secure way to attach/review supporting evidence before approval. Do not expose private evidence publicly.

### 4.5 Artwork media upload

Use a two-step signed upload, following the existing business-media gallery pattern. Exact reuse of the current bucket, file limits, image processing and storage policy must be confirmed by the backend owner; do not assume the business-photo bucket is appropriate for creator works.

Create an upload intent:

`POST /creator/artworks/:artworkId/media/upload-intents`

Request:

```json
{
  "filename": "artwork-image.webp",
  "mimeType": "image/webp",
  "byteSize": 482193,
  "accessibilityText": "A digital illustration of...",
  "caption": "Creator-provided caption.",
  "isCover": true
}
```

Proposed initial policy: JPEG, PNG, WebP or AVIF; maximum 10 MiB per image; up to 10 media items per artwork. Backend must confirm image dimensions, processing, malware/content validation and any additional format restrictions before implementation.

Response:

```json
{
  "data": {
    "mediaId": "media_opaque_id",
    "uploadUrl": "https://short-lived-signed-upload-url",
    "token": "short-lived-upload-token",
    "expiresIn": 900,
    "requiredHeaders": {
      "Content-Type": "image/webp"
    }
  }
}
```

Frontend uploads the binary directly to the returned signed URL, using only the returned headers/token, and reports progress. Do not send binary data through the JSON API and do not persist the signed URL/token.

Complete upload:

`POST /creator/artworks/:artworkId/media/:mediaId/complete`

Request body: `{}`.

Response: `{ "data": { "mediaId": "...", "status": "READY_FOR_REVIEW" } }`.

The server must verify ownership, upload expiry, actual size, MIME type and file signature. A client-side MIME check is not sufficient. An incomplete, expired or invalid upload must not be attached to a publishable artwork. Return a structured error and allow a fresh upload intent.

Media DTO:
```json
{
  "mediaId": "media_opaque_id",
  "filename": "artwork-image.webp",
  "mimeType": "image/webp",
  "byteSize": 482193,
  "caption": "Creator-provided caption.",
  "accessibilityText": "A digital illustration of...",
  "isCover": true,
  "status": "READY_FOR_REVIEW",
  "previewUrl": "https://short-lived-private-preview-url"
}
```

### 4.6 Submit artwork for review

`POST /creator/artworks/:artworkId/submit`

Request:

```json
{
  "confirmRightsAndPermissions": true,
  "confirmAccurateAttribution": true,
  "confirmCulturalCare": true
}
```

The server must independently validate:
- Creator profile exists and is in an eligible state.
- Required artwork fields and at least one valid media item are present.
- Every media upload has completed and passed server-side validation.
- Rights basis and attribution are provided.
- Required third-party, licence-holder or community permissions are documented and approved where applicable.
- No unresolved required content restriction or moderation hold exists.

If a permission is `PENDING` or `NOT_SURE`, submission may be saved as a draft but must not enter the approval-ready queue or become public. Sacred, restricted, community-owned or otherwise sensitive cultural material must not be published without the relevant authorization. The backend must support a manual escalation path for uncertain cases.

Response:
```json
{
  "data": {
    "artworkId": "artwork_opaque_id",
    "status": "PENDING_REVIEW",
    "submittedAt": "2026-11-05T12:00:00.000Z"
  }
}
```

Artwork statuses:
- `DRAFT`
- `PENDING_UPLOAD`
- `PENDING_REVIEW`
- `CHANGES_REQUESTED`
- `APPROVED`
- `REJECTED`
- `ARCHIVED`

The server, not the client, controls status transitions. A submitted or approved artwork cannot be edited in place by its creator. Changes to approved content must use a revision/resubmission flow so the previously approved public version is not silently overwritten.

## 5. Creator review feedback

The creator detail/list responses include feedback records visible only to that creator:

```json
{
  "feedbackId": "feedback_opaque_id",
  "category": "RIGHTS_AND_PERMISSION",
  "message": "Please provide evidence of permission to use this community-owned design.",
  "createdAt": "2026-11-05T12:00:00.000Z"
}
```

Categories: `IDENTITY`, `ATTRIBUTION`, `RIGHTS_AND_PERMISSION`, `CULTURAL_CONTEXT`, `IMAGE_QUALITY`, `ACCESSIBILITY`, `CONTENT_POLICY`, `OTHER`.

Feedback must not expose internal moderator notes, reporter details, private evidence URLs, or other creators' records.

## 6. Admin moderation

### 6.1 List the moderation queue

`GET /admin/creator-submissions?status=PENDING_REVIEW&cursor=&limit=`

Admin/moderator permission required. The queue supports filters for submission type (`CREATOR_PROFILE` or `ARTWORK`), status, discipline and submission date. Pagination uses an opaque cursor; default 20, maximum 50.

Response:
```json
{
  "data": {
    "items": [
      {
        "submissionType": "ARTWORK",
        "submissionId": "artwork_opaque_id",
        "creatorId": "creator_opaque_id",
        "creatorDisplayName": "Creator display name",
        "title": "Artwork title",
        "discipline": "DIGITAL_ART",
        "status": "PENDING_REVIEW",
        "submittedAt": "2026-11-05T12:00:00.000Z"
      }
    ],
    "nextCursor": null
  }
}
```

### 6.2 Read a submission for review

`GET /admin/creator-submissions/:submissionId?type=ARTWORK`

Returns full review details, private preview URLs with short expiry, rights declarations, permission evidence metadata and audit history permitted to the moderator. The API must not expose storage service credentials or permanent private storage paths.

### 6.3 Record a review decision

`POST /admin/creator-submissions/:submissionId/review`

Request for approval:
```json
{
  "type": "ARTWORK",
  "decision": "APPROVED",
  "reason": "Rights and attribution evidence reviewed; content approved for publication."
}
```

Request for changes:
```json
{
  "type": "ARTWORK",
  "decision": "CHANGES_REQUESTED",
  "reason": "Please add the source community and permission details.",
  "feedback": [
    {
      "category": "RIGHTS_AND_PERMISSION",
      "message": "Please add the source community and permission details."
    }
  ]
}
```

Request for rejection:
```json
{
  "type": "ARTWORK",
  "decision": "REJECTED",
  "reason": "The submitted work cannot be published because the required permission was not established."
}
```

Decisions: `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`. A non-empty reason is required for every decision. Only authorized moderators can decide. Every decision must record actor, timestamp, submission version, decision, reason and feedback in an immutable audit trail. The server must prevent self-approval where the submitter is also a moderator, unless the platform's policy explicitly authorizes and audits an exception.

Response: `{ "data": { "submissionId": "...", "status": "APPROVED", "reviewedAt": "...", "reviewVersion": 1 } }`.

Creator-profile moderation uses the same queue and review resource with `type=CREATOR_PROFILE`, and may decide `VERIFIED`, `CHANGES_REQUESTED` or `REJECTED`. A creator profile must be verified before any artwork is publicly listed.

## 7. Public discovery endpoints

### 7.1 Public creator profile

`GET /art-culture/creators/:slug`

No authentication required. Returns only a verified, active creator and their approved, published artworks. Unknown, unverified, suspended or unpublished profiles return the platform's normal not-found response; do not reveal private review state.

### 7.2 Public artwork discovery

`GET /art-culture/artworks?discipline=&countryCode=&cursor=&limit=`

No authentication required. Returns approved, published artworks from verified, active creators only. Support discipline and country filters; default 20, maximum 50. Results must have stable ordering and cursor pagination.

Public DTOs must omit:
- Private email, phone, account/user IDs and private creator notes.
- Review feedback and moderator identity/notes.
- Rights evidence files, private permission documents and internal audit events.
- Draft, pending, rejected, suspended or archived records.
- Private storage paths and long-lived signed URLs.

Public artwork fields: `artworkId`, `slug`, `title`, `creator` (public slug/display name/location), `discipline`, `description`, `creationYear`, `origin`, `culturalContext` (only when approved for public display), `tags`, `accessibilityText`, approved public media URLs, public attribution/licence label, and `publishedAt`.

If an approved creator or artwork is suspended, withdrawn, or has a permission issue, public discovery must stop returning it according to the moderation policy, with an auditable status transition.

## 8. Errors and frontend behavior

Use existing API error envelope and stable machine-readable codes. Proposed codes:
- `CREATOR_PROFILE_REQUIRED`
- `CREATOR_PROFILE_INCOMPLETE`
- `CREATOR_PROFILE_NOT_VERIFIED`
- `ARTWORK_NOT_FOUND`
- `ARTWORK_NOT_EDITABLE`
- `ARTWORK_VALIDATION_FAILED`
- `UPLOAD_EXPIRED`
- `UPLOAD_NOT_FOUND`
- `UPLOAD_METADATA_MISMATCH`
- `INVALID_MEDIA_CONTENT`
- `MEDIA_LIMIT_REACHED`
- `RIGHTS_CONFIRMATION_REQUIRED`
- `PERMISSION_REVIEW_REQUIRED`
- `MODERATOR_ACCESS_REQUIRED`
- `REVIEW_ALREADY_COMPLETED`
- `IDEMPOTENCY_CONFLICT`

Frontend must:
- Preserve entered draft values on recoverable errors.
- Show field-level validation messages where supplied.
- Retry only safe reads and upload operations with a fresh signed intent when expired; never blindly repeat a submission or review decision after an unknown network outcome.
- Refresh authoritative status after every mutation; never infer approval from a successful upload or button click.
- Display upload progress and distinguish uploading, upload failed, uploaded-awaiting-review, approved and rejected.
- Never show an artwork publicly based on client-side state.

## 9. Security, privacy and audit requirements

- Enforce creator ownership and moderator permissions on every request, not only in the UI.
- Use existing session authentication, CSRF and same-origin controls. Do not add a new auth system.
- Use private object storage and short-lived signed URLs for drafts, pending submissions, moderator previews and permission evidence.
- Validate content type, file signature, file size and actual object metadata server-side; use safe image processing and malware scanning as supported by platform standards.
- Prevent path traversal, arbitrary storage-key selection, cross-creator media attachment, replayed completion and cross-tenant access.
- Rate-limit onboarding, upload-intent creation, submission and moderation endpoints.
- Audit profile changes, media lifecycle, submission, review decision, publication, withdrawal and permission-related holds.
- Keep public DTOs separate from creator-owner and moderator DTOs.
- Retain original submission/review versions so approved public work cannot be silently altered.
- Provide a takedown/withdrawal route and a way to suspend a creator/artwork pending a rights or safety investigation. Backend team to define operational SLA and retention policy.

## 10. Frontend integration sequence

1. Backend confirms this contract, existing API envelope, auth/CSRF/idempotency behavior, role names and storage policy.
2. Backend publishes the canonical route/DTO definitions in the shared contracts package and implements test fixtures.
3. Frontend adds typed API adapters and contract tests without exposing non-persistent submit buttons.
4. Implement creator profile onboarding and draft save.
5. Implement artwork draft, signed media upload and completion.
6. Implement submission tracking and creator feedback.
7. Implement moderator queue and review decisions using the existing admin permission model.
8. Connect public discovery only after verified/approved backend responses exist.
9. Run authorization, upload security, accessibility, responsive, regression and production-readiness checks.

## 11. Backend decisions required before implementation

The backend owner must explicitly confirm:
1. Canonical creator and moderator role/permission model (reuse current roles or define narrowly scoped permissions).
2. Whether creator profiles are self-service and whether profile verification is mandatory before draft creation or only before publication.
3. Canonical discipline, rights, licence, content-notice and status enums.
4. Storage bucket/policy, file size/count/dimension limits, supported formats, image transformations, malware scanning and signed URL expiry.
5. Whether artwork upload can reuse the existing business-media signed-upload service without coupling creator media to business ownership.
6. How permission evidence is stored, reviewed, access-controlled and retained.
7. Review queue ownership, moderation escalation, self-approval prohibition and decision audit requirements.
8. Exact idempotency header behavior and error envelope for mutations.
9. Revision model for edits to approved artworks, takedowns and withdrawal.
10. API pagination and public URL/slug policy.

**Integration gate:** frontend must not connect to guessed endpoints or present a submission as saved until the backend confirms the contract and a working environment exposes the agreed routes. Until then, UI work must clearly identify itself as a non-persistent prototype and disable data-submission claims.
