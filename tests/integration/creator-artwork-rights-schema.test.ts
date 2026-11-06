import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const migration = readFileSync(new URL('../../database/migrations/034_creator_artwork_rights_workflow.sql', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../../backend/platform/src/creatorArtworkRights.ts', import.meta.url), 'utf8');
const artworkRoutes = readFileSync(new URL('../../backend/platform/src/creatorArtworks.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../backend/platform/src/app.ts', import.meta.url), 'utf8');

describe('7EVEN creator artwork rights workflow', () => {
  it('stores private evidence, community permissions, attribution reviews and immutable decisions', () => {
    for (const table of [
      'creator_artwork_rights_evidence',
      'creator_artwork_community_permissions',
      'creator_artwork_attribution_reviews',
      'creator_artwork_rights_decisions',
    ]) assert.match(migration, new RegExp('CREATE TABLE seven\\.' + table));
    assert.match(migration, /GRANT SELECT, INSERT ON seven\.creator_artwork_rights_decisions TO seven_app/);
    assert.doesNotMatch(migration, /GRANT .*UPDATE ON seven\.creator_artwork_rights_decisions/);
  });

  it('mounts creator-owned evidence, permission and attribution submission routes', () => {
    assert.match(app, /mountCreatorArtworkRights\(app, \{ pool, actor: actorFor \}\)/);
    for (const route of [
      '/api/creator/artworks/:artworkId/rights/evidence',
      '/api/creator/artworks/:artworkId/rights/community-permissions',
      '/api/creator/artworks/:artworkId/rights/attribution',
      '/api/admin/creator-rights/:kind/:recordId/review',
      '/api/admin/creator-submissions/:submissionId/rights/hold',
      '/api/admin/creator-submissions/:submissionId/rights/restore',
    ]) assert.ok(routes.includes(route), 'Missing rights route ' + route);
  });

  it('requires verified evidence, approved community permission and verified attribution before publication', () => {
    assert.match(artworkRoutes, /RIGHTS_EVIDENCE_REQUIRED/);
    assert.match(artworkRoutes, /PERMISSION_EVIDENCE_REQUIRED/);
    assert.match(artworkRoutes, /ATTRIBUTION_VERIFICATION_REQUIRED/);
    assert.match(artworkRoutes, /status='VERIFIED'/);
    assert.match(artworkRoutes, /status='APPROVED'/);
  });

  it('audits moderator decisions and prevents repeat decisions', () => {
    assert.match(routes, /RIGHTS_REVIEW_ALREADY_COMPLETED/);
    assert.match(routes, /INSERT INTO seven\.creator_artwork_rights_decisions/);
    assert.match(routes, /INSERT INTO seven\.audit_events/);
  });

  it('restricts rights holds to published works and restoration to verified, eligible works', () => {
    assert.match(routes, /RIGHTS_HOLD_NOT_ALLOWED/);
    assert.match(routes, /RESTORE_NOT_ALLOWED/);
    assert.match(routes, /CULTURAL_REVIEW_REQUIRED/);
    assert.match(routes, /ARTWORK_MEDIA_REQUIRED/);
    assert.match(routes, /CREATOR_NOT_VERIFIED/);
  });

  it('keeps evidence endpoints authenticated and moderator-only for decisions', () => {
    assert.match(routes, /const user=actor\(res\)/);
    assert.match(routes, /requireAdmin\(user\)/);
    assert.match(routes, /Idempotency-Key/);
  });
});
