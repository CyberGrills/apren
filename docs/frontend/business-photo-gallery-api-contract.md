# Business Photos & Gallery — frontend API contract

This document is the frontend integration contract for the 7EVEN business photo gallery. It describes the data and HTTP interface expected by the React application; it does not implement or prescribe the backend architecture.

The frontend implementation lives in:
- `apps/web/src/pages/workspace/BusinessPhotoGallery.tsx`
- `apps/web/src/pages/workspace/AdminBusinessMedia.tsx`
- `apps/web/src/pages/public/BusinessDirectoryCard.tsx`
- `apps/web/src/lib/businessMediaApi.ts`

## Owner workspace

All routes below require an authenticated business owner scoped to their active business. The frontend must never receive storage service credentials.

### List gallery

`GET /business/media`

Response:

```json
{
  "items": [
    {
      "mediaId": "media_123",
      "originalFilename": "guest-room.jpg",
      "mimeType": "image/jpeg",
      "byteSize": 482193,
      "caption": "Bright guest room with balcony access",
      "altText": "Queen bed beside a window and balcony door",
      "status": "APPROVED",
      "rejectionReason": null,
      "sortOrder": 0,
      "isCover": true,
      "imageUrl": "https://signed-image-url",
      "createdAt": "2026-11-02T12:00:00.000Z"
    }
  ]
}
```

Statuses: `PENDING_UPLOAD`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `REMOVED`.

### Create upload intent

`POST /business/media/upload-intents`

Request:

```json
{
  "filename": "guest-room.jpg",
  "mimeType": "image/jpeg",
  "byteSize": 482193,
  "caption": "Bright guest room",
  "altText": "Queen bed beside a window",
  "replacesMediaId": "media_previous"
}
```

`replacesMediaId` is optional.

Response:

```json
{
  "mediaId": "media_456",
  "uploadUrl": "https://storage-upload-url",
  "token": "short-lived-upload-token",
  "expiresIn": 900,
  "requiredHeaders": {
    "Content-Type": "image/jpeg"
  }
}
```

The frontend uploads the binary to the returned signed URL with the short-lived token and reports upload progress. The upload URL/token are temporary; they are not persisted by the frontend.

### Complete upload

`POST /business/media/:mediaId/complete`

Request body: `{}`

Response:

```json
{
  "mediaId": "media_456",
  "status": "PENDING_REVIEW"
}
```

### Update caption and alt text

`PATCH /business/media/:mediaId`

Request:

```json
{
  "caption": "Updated caption",
  "altText": "A queen bed with fresh white linen"
}
```

### Select cover

`PATCH /business/media/:mediaId/cover`

Request body: `{}`.

### Reorder approved gallery

`PATCH /business/media/order`

Request:

```json
{
  "mediaIds": ["media_456", "media_123"]
}
```

The array is the intended order from first to last.

### Remove photo

`DELETE /business/media/:mediaId`

The frontend expects a successful 2xx response.

## Administrator moderation

These routes require an administrator session.

### List pending submissions

`GET /admin/business-media`

Response:

```json
{
  "items": [
    {
      "mediaId": "media_456",
      "businessId": "business_123",
      "businessName": "Example Apartments",
      "originalFilename": "guest-room.jpg",
      "mimeType": "image/jpeg",
      "byteSize": 482193,
      "caption": "Bright guest room",
      "altText": "A queen bed beside a window",
      "createdAt": "2026-11-02T12:00:00.000Z",
      "replacedMediaId": null,
      "imageUrl": "https://short-lived-private-preview-url"
    }
  ]
}
```

### Approve or reject

`PATCH /admin/business-media/:mediaId/review`

Approve:

```json
{
  "decision": "APPROVED"
}
```

Reject:

```json
{
  "decision": "REJECTED",
  "reason": "Please upload a sharper image without a watermark."
}
```

The frontend requires a non-empty rejection reason before it enables the Reject action.

## Public directory

Public business profile data may include:

```json
{
  "photos": [
    {
      "imageUrl": "https://short-lived-approved-image-url",
      "altText": "A queen bed beside a window",
      "caption": "Bright guest room",
      "isCover": true
    }
  ]
}
```

Only approved photos should be returned to public-facing pages. If there are no approved photos, the frontend uses the existing original-photo placeholder.

## Frontend expectations

- Keep image uploads binary and separate from JSON API calls.
- Return short-lived signed URLs for private owner/admin previews and public-approved photos where the bucket is private.
- Do not return storage secrets or privileged credentials to the browser.
- Return consistent JSON error envelopes understood by the existing `api()` client.
- A replacement should not remove the existing approved image before the replacement has passed review.
- Keep the response fields and status values stable, or update the typed adapter and its tests together.
