import assert from 'node:assert/strict';
import testCase from 'node:test';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const ownerGallery = source('../../apps/web/src/pages/workspace/BusinessPhotoGallery.tsx');
const adminGallery = source('../../apps/web/src/pages/workspace/AdminBusinessMedia.tsx');
const app = source('../../apps/web/src/App.tsx');
const navigation = source('../../apps/web/src/components/WorkspaceShell.tsx');
const businessCard = source('../../apps/web/src/pages/public/BusinessDirectoryCard.tsx');
const mediaApi = source('../../apps/web/src/lib/businessMediaApi.ts');
const contract = source('../../docs/frontend/business-photo-gallery-api-contract.md');

testCase('owner gallery supports multi-file upload, previews, progress, captions and alt text', () => {
  assert.match(ownerGallery, /multiple onChange/);
  assert.match(ownerGallery, /upload\\.onprogress/);
  assert.match(ownerGallery, /URL\\.createObjectURL/);
  assert.match(ownerGallery, /aria-valuenow/);
  assert.match(ownerGallery, /drag and drop/);
  assert.match(ownerGallery, /caption/);
  assert.match(ownerGallery, /altText/);
  assert.match(ownerGallery, /10 \\* 1024 \\* 1024/);
});

testCase('owner gallery exposes cover, ordering, replacement and removal controls', () => {
  assert.match(ownerGallery, /replacesMediaId/);
  assert.match(ownerGallery, /Set cover/);
  assert.match(ownerGallery, /businessMediaApi\\.reorder/);
  assert.match(ownerGallery, /businessMediaApi\\.remove/);
  assert.match(ownerGallery, /businessMediaApi\\.setCover/);
});

testCase('owner gallery communicates approved, pending and rejected photo states', () => {
  assert.match(ownerGallery, /PENDING_REVIEW/);
  assert.match(ownerGallery, /REJECTED/);
  assert.match(ownerGallery, /Approved and guest-facing/);
  assert.match(ownerGallery, /Needs your attention/);
});

testCase('admin moderation supports search, replacement filter and approve/reject actions', () => {
  assert.match(adminGallery, /setSearch/);
  assert.match(adminGallery, /REPLACEMENTS/);
  assert.match(adminGallery, /businessMediaApi\\.review/);
  assert.match(adminGallery, /'APPROVED'/);
  assert.match(adminGallery, /'REJECTED'/);
  assert.match(adminGallery, /Add a clear reason before rejecting/);
});

testCase('gallery routes and navigation are registered in the frontend', () => {
  assert.ok(app.includes('path="media" element={<AdminBusinessMedia />}'));
  assert.match(app, /'photos'/);
  assert.ok(navigation.includes("/business/photos"));
  assert.ok(navigation.includes("/admin/media"));
});

testCase('public business cards can render the approved photo gallery', () => {
  assert.match(businessCard, /profile\\.photos\\?\\.length/);
  assert.match(businessCard, /seven-business-photo-thumbnails/);
  assert.match(businessCard, /altText/);
});

testCase('typed frontend adapter and backend handoff contract define the same integration surface', () => {
  for (const route of [
    '/business/media',
    '/business/media/upload-intents',
    '/business/media/order',
    '/admin/business-media',
  ]) assert.ok(mediaApi.includes(route), 'Missing frontend route: ' + route);
  for (const operation of ['createUploadIntent', 'completeUpload', 'updateDetails', 'setCover', 'reorder', 'remove', 'review']) {
    assert.ok(mediaApi.includes(operation), 'Missing frontend operation: ' + operation);
  }
  for (const section of ['Owner workspace', 'Administrator moderation', 'Public directory', 'Frontend expectations']) {
    assert.ok(contract.includes(section), 'Missing API contract section: ' + section);
  }
});
