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
  for (const feature of ['multiple onChange', 'upload.onprogress', 'URL.createObjectURL', 'aria-valuenow', 'drag and drop', 'caption', 'altText', '10 * 1024 * 1024']) {
    assert.ok(ownerGallery.includes(feature), 'Missing owner gallery feature: ' + feature);
  }
});

testCase('owner gallery exposes cover, ordering, replacement and removal controls', () => {
  for (const feature of ['replacesMediaId', 'Set cover', 'businessMediaApi.reorder', 'businessMediaApi.remove', 'businessMediaApi.setCover']) {
    assert.ok(ownerGallery.includes(feature), 'Missing gallery control: ' + feature);
  }
});

testCase('owner gallery communicates approved, pending and rejected photo states', () => {
  for (const feature of ['PENDING_REVIEW', 'REJECTED', 'Approved and guest-facing', 'Needs your attention']) {
    assert.ok(ownerGallery.includes(feature), 'Missing gallery state: ' + feature);
  }
});

testCase('admin moderation supports search, replacement filter and approve/reject actions', () => {
  for (const feature of ['setSearch', 'REPLACEMENTS', 'businessMediaApi.review', 'APPROVED', 'REJECTED', 'Add a clear reason before rejecting']) {
    assert.ok(adminGallery.includes(feature), 'Missing moderation feature: ' + feature);
  }
});

testCase('gallery routes and navigation are registered in the frontend', () => {
  assert.ok(app.includes('path="media" element={<AdminBusinessMedia />}'));
  assert.ok(app.includes("'photos'"));
  assert.ok(navigation.includes('/business/photos'));
  assert.ok(navigation.includes('/admin/media'));
});

testCase('public business cards can render the approved photo gallery', () => {
  assert.ok(businessCard.includes('profile.photos?.length'));
  assert.ok(businessCard.includes('seven-business-photo-thumbnails'));
  assert.ok(businessCard.includes('altText'));
});

testCase('typed frontend adapter and backend handoff contract define the same integration surface', () => {
  for (const route of ['/business/media', '/business/media/upload-intents', '/business/media/order', '/admin/business-media']) {
    assert.ok(mediaApi.includes(route), 'Missing frontend route: ' + route);
  }
  for (const operation of ['createUploadIntent', 'completeUpload', 'updateDetails', 'setCover', 'reorder', 'remove', 'review']) {
    assert.ok(mediaApi.includes(operation), 'Missing frontend operation: ' + operation);
  }
  for (const section of ['Owner workspace', 'Administrator moderation', 'Public directory', 'Frontend expectations']) {
    assert.ok(contract.includes(section), 'Missing API contract section: ' + section);
  }
});

testCase('gallery action failures do not show a retry button that only dismisses the error', () => {
  assert.ok(
    ownerGallery.includes('{actionError && <ErrorNotice message={actionError} />}'),
    'Action errors should be dismissible without advertising a retry that does not repeat the failed action.',
  );
  assert.ok(
    ownerGallery.includes('{error && <ErrorNotice message={error} retry={reload} />}'),
    'The gallery read error should retain its real reload action.',
  );
  assert.ok(
    !ownerGallery.includes("retry={() => setActionError('')}"),
    'Clearing the error is not a retry and must not be labelled as one.',
  );
});
