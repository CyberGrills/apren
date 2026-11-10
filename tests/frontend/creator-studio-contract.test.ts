import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../../frontend/src/App.tsx');
const api = read('../../frontend/src/lib/creatorApi.ts');
const studio = read('../../frontend/src/pages/public/CreatorStudioPage.tsx');
const publicPage = read('../../frontend/src/pages/public/CreatorPublicPage.tsx');
const collectionPage = read('../../frontend/src/pages/public/ArtCulturePage.tsx');
const backend = read('../../backend/platform/src/creatorArtworks.ts');
const rightsBackend = read('../../backend/platform/src/creatorArtworkRights.ts');

test('creator studio and public creator pages are registered on the expected routes', () => {
  assert.match(app, /<Route path="\/creator" element={<CreatorStudioPage \/>} \/>/);
  assert.match(app, /<Route path="\/creators\/:slug" element={<CreatorPublicPage \/>} \/>/);
  assert.match(app, /const CreatorStudioPage = lazy/);
  assert.match(app, /const CreatorPublicPage = lazy/);
});

test('creator profile and artwork mutations use the merged API contract with idempotency keys', () => {
  for (const route of [
    "'/creator/profile'", "'/creator/profile/submit'", "'/creator/artworks'",

  ]) assert.ok(api.includes(route), `missing creator API route ${route}`);
  assert.match(api, /media\/upload-intents/);
  assert.match(api, /media\/reorder/);
  assert.match(api, /rights\/evidence/);
  assert.match(api, /rights\/community-permissions/);
  assert.match(api, /rights\/attribution/);
  assert.match(api, /idempotencyKey: key\(\)/);
  assert.match(backend, /app\.post\('\/api\/creator\/artworks\/:artworkId\/media\/upload-intents'/);
  assert.match(backend, /app\.post\('\/api\/creator\/artworks\/:artworkId\/media\/reorder'/);
  assert.match(backend, /app\.post\('\/api\/creator\/artworks\/:artworkId\/submit'/);
});

test('creator workspace supports draft editing, image upload progress, rights declarations and review feedback', () => {
  assert.match(studio, /Create artwork draft/);
  assert.match(studio, /Upload images/);
  assert.match(studio, /role="progressbar"/);
  assert.match(studio, /Review feedback/);
  assert.match(studio, /Community-held material permissions/);
  assert.match(studio, /Submit artwork for review/);
  assert.match(studio, /submitConfirmations\.confirmPublicVisibility/);
  assert.match(api, /submitArtwork: \(id: string, confirmations:/);
  assert.match(studio, /Only verified creators and approved artworks can appear publicly/);
});

test('rights document attachments stay disabled until a merged file-upload contract exists', () => {
  assert.match(studio, /File attachments are not enabled in this release/);
  assert.match(rightsBackend, /\/rights\/evidence/);
  assert.doesNotMatch(rightsBackend, /\/rights\/documents/);
  assert.doesNotMatch(api, /rights\/documents/);
});

test('public collection and creator pages render only backend-approved public projections', () => {
  assert.match(backend, /a\.public_active AND a\.status='APPROVED' AND c\.profile_status='VERIFIED'/);
  assert.match(backend, /WHERE slug=\$1 AND profile_status='VERIFIED'/);
  assert.match(publicPage, /art-culture\/creators/);
  assert.match(collectionPage, /art-culture\/artworks\?limit=50/);
  assert.match(collectionPage, /PublicArtworkCard/);
});
