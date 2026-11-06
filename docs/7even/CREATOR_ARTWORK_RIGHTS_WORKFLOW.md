# 7EVEN Creator Artwork Rights Workflow

**Status:** PR #185 implementation contract  
**Scope:** Backend workflow for creator-submitted rights evidence, community permission, attribution verification and audited restoration.  
**Privacy:** Rights references, evidence metadata, review reasons and decision history are private. Public artwork DTOs must not include them.

## Creator endpoints

All mutation requests use the existing session authentication, CSRF protection and actor-scoped `Idempotency-Key` contract.

### Submit licensed / ownership evidence

`POST /api/creator/artworks/:artworkId/rights/evidence`

Request:
```json
{
  "evidenceType": "LICENSE",
  "issuerName": "Rights holder or issuing organization",
  "evidenceReference": "Private evidence reference",
  "description": "What the document establishes and the scope of use."
}
```

Supported evidence types: `LICENSE`, `OWNERSHIP`, `AUTHORIZED_REPRESENTATIVE`, `SOURCE_PERMISSION`, `OTHER`. The returned record begins in `PENDING_REVIEW`. A reference is metadata only; this route does not upload a file or create a public URL.

### Document community permission

`POST /api/creator/artworks/:artworkId/rights/community-permissions`

Request:
```json
{
  "communityName": "Source community",
  "authorityName": "Permission-granting authority",
  "permissionScope": "Specific artwork, medium, territory and display scope",
  "evidenceReference": "Private permission record reference",
  "culturalContext": "Context needed for a careful review."
}
```

Permission records enter `PENDING_REVIEW`. Approval is a moderator decision, not a creator assertion. Sacred, restricted or otherwise sensitive cultural material remains blocked by the existing publication safeguard; this workflow does not waive that safeguard.

### Submit attribution for verification

`POST /api/creator/artworks/:artworkId/rights/attribution`

Request:
```json
{
  "attributionText": "Creator / source / community attribution",
  "sourceDescription": "How the attribution and source were established."
}
```

### Read own rights records

`GET /api/creator/artworks/:artworkId/rights`

Returns the creator's evidence, permission and attribution records with their current review state and creator-visible review reason.

## Moderator endpoints

Admin role is required.

- `GET /api/admin/creator-submissions/:submissionId/rights` — private evidence, permission, attribution and decision history.
- `POST /api/admin/creator-rights/evidence/:recordId/review`
- `POST /api/admin/creator-rights/community-permission/:recordId/review`
- `POST /api/admin/creator-rights/attribution/:recordId/review`

Review body:
```json
{ "decision": "VERIFIED", "reason": "Evidence scope and issuing authority were checked." }
```

Evidence and attribution decisions are `VERIFIED` or `REJECTED`; community permission decisions are `APPROVED` or `REJECTED`. Every decision is recorded once in the append-only rights decision table and in the platform audit log. Repeated decisions return `RIGHTS_REVIEW_ALREADY_COMPLETED`.

### Rights hold and restoration

- `POST /api/admin/creator-submissions/:submissionId/rights/hold` — immediately unlists a currently published artwork and records the reason.
- `POST /api/admin/creator-submissions/:submissionId/rights/restore` — restores a previously published, suspended artwork only after creator verification, required rights evidence, community permission, attribution, media and cultural-display gates pass.

Restoration is a new audited moderator decision. It never edits or deletes the original evidence or decision history.

## Publication gates

- `LICENSED` and `AUTHORIZED_REPRESENTATIVE` require at least one moderator-verified rights evidence record.
- `communityPermission: OBTAINED` requires a moderator-approved community permission record.
- `PENDING` and `NOT_SURE` community permission states block publication.
- Every artwork requires a moderator-verified attribution record.
- Existing verified-creator, explicit public-visibility confirmation, complete-media and sensitive-cultural-display restrictions remain in force.
- Evidence references and internal review data are not added to public DTOs.

## Release boundary

Migration `034_creator_artwork_rights_workflow.sql` is a repository change only. It has not been applied to production. No production deployment, NFT minting, wallet, blockchain or payment change is included.
