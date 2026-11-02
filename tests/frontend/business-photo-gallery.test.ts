import assert from 'node:assert/strict';
import testCase from 'node:test';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const ownerGallery = source('../../apps/web/src/pages/workspace/BusinessPhotoGallery.tsx');
const adminGallery = source('../../apps/web/src/pages/workspace/AdminBusinessMedia.tsx');
const app = source('../../apps/web/src/App.tsx');
const navigation = source('../../apps/web/src/components/WorkspaceShell.tsx');
const backend = source('../../services/platform/src/businessMedia.ts');
const businessCard = source('../../apps/web/src/pages/public/BusinessDirectoryCard.tsx');
const platformApp = source('../../services/platform/src/app.ts');

testCase('business owner gallery supports multi-file upload, progress, captions and alt text', () => {
  assert.match(ownerGallery, /multiple onChange/);
  assert.match(ownerGallery, /upload\.onprogress/);
  assert.match(ownerGallery, /caption/);
  assert.match(ownerGallery, /altText/);
  assert.match(ownerGallery, /URL\.createObjectURL/);
  assert.match(ownerGallery, /10 \* 1024 \* 1024/);
});

testCase('business gallery supports approved photo cover, ordering, replacement and removal', () => {
  assert.match(ownerGallery, /replacesMediaId/);
  assert.match(ownerGallery, /Set cover/);
  assert.match(ownerGallery, /business\/media\/order/);
  assert.match(ownerGallery, /'DELETE'/);
  assert.match(backend, /status='APPROVED'/);
  assert.match(backend, /business_media\.cover_selected/);
});

testCase('owner gallery exposes review status while admin review controls approval and rejection', () => {
  assert.match(ownerGallery, /PENDING_REVIEW/);
  assert.match(ownerGallery, /REJECTED/);
  assert.match(adminGallery, /decision, \.\.\./);
  assert.match(adminGallery, /'APPROVED'/);
  assert.match(adminGallery, /'REJECTED'/);
  assert.match(backend, /admin\.role !== 'ADMIN'/);
  assert.match(backend, /'business_media\.' \+ input\.decision\.toLowerCase\(\)/);
});

testCase('photo workspace and administrator moderation routes are registered', () => {
  assert.match(app, /path="media" element={<AdminBusinessMedia \/>}/);
  assert.match(app, /'photos'/);
  assert.match(navigation, /\/business\/photos/);
  assert.match(navigation, /\/admin\/media/);
});

testCase('public business directory exposes approved photos only', () => {
  assert.match(backend, /status='APPROVED' ORDER BY is_cover DESC,sort_order,created_at LIMIT 12/);
  assert.match(platformApp, /businessMediaGallery\(pool, business\.id\)/);
  assert.match(businessCard, /seven-business-photo-thumbnails/);
  assert.match(businessCard, /profile\.photos\?\.length/);
});
