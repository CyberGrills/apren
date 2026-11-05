import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const migration = readFileSync(new URL('../../database/migrations/033_creator_artwork_foundation.sql', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../../backend/platform/src/creatorArtworks.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../backend/platform/src/app.ts', import.meta.url), 'utf8');

describe('7EVEN creator artwork backend foundation', () => {
  it('creates creator, artwork and media records with bounded image formats and private storage', () => {
    assert.match(migration, /CREATE TABLE seven\.creator_profiles/);
    assert.match(migration, /CREATE TABLE seven\.creator_artworks/);
    assert.match(migration, /CREATE TABLE seven\.creator_artwork_media/);
    assert.match(migration, /creator-artwork-media','creator-artwork-media',false,10485760/);
    assert.match(migration, /byte_size > 0 AND byte_size <= 10485760/);
    assert.match(migration, /seven_readonly_select_access/);
  });

  it('registers authenticated creator routes and admin moderation routes', () => {
    assert.match(app, /import \{ mountCreatorArtworks \} from '\.\/creatorArtworks\.ts'/);
    assert.match(app, /mountCreatorArtworks\(app, \{ pool, actor: actorFor \}\)/);
    for (const route of [
      '/api/creator/profile',
      '/api/creator/profile/submit',
      '/api/creator/artworks',
      '/api/creator/artworks/:artworkId/media/upload-intents',
      '/api/creator/artworks/:artworkId/submit',
      '/api/admin/creator-submissions',
      '/api/admin/creator-submissions/:submissionId/review',
      '/api/admin/creator-submissions/:submissionId/takedown',
      '/api/art-culture/artworks',
      '/api/art-culture/creators/:slug',
    ]) assert.ok(routes.includes(route), 'Missing route ' + route);
  });

  it('uses actor-scoped idempotency and writes an audit event for mutations', () => {
    assert.match(routes, /Idempotency-Key/);
    assert.match(routes, /IDEMPOTENCY_CONFLICT/);
    assert.match(routes, /INSERT INTO seven\.idempotencies/);
    assert.match(routes, /INSERT INTO seven\.audit_events/);
  });

  it('does not publish before verified creator, resolved permissions and complete media gates', () => {
    assert.match(routes, /CREATOR_NOT_VERIFIED/);
    assert.match(routes, /PERMISSION_REVIEW_REQUIRED/);
    assert.match(routes, /ARTWORK_MEDIA_REQUIRED/);
    assert.match(routes, /public_active=true/);
    assert.match(routes, /confirmPublicVisibility/);
    assert.match(routes, /SELF_APPROVAL_FORBIDDEN/);
  });

  it('keeps public discovery restricted to active approved works and verified creators', () => {
    assert.match(routes, /a\.public_active AND a\.status='APPROVED' AND c\.profile_status='VERIFIED'/);
    assert.match(routes, /status='READY_FOR_REVIEW'/);
  });

  it('supports creator media management and public takedown', () => {
    assert.match(routes, /media\/reorder/);
    assert.match(routes, /cover_selected/);
    assert.match(routes, /creator_artwork_media\.removed/);
    assert.match(routes, /creator_artwork\.withdrawn/);
    assert.match(routes, /creator_artwork\.taken_down/);
  });
});
