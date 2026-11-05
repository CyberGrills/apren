import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { decodePageCursor, encodePageCursor, pageResult } from '../../backend/platform/src/creatorArtworks.ts';

const migration = readFileSync(new URL('../../database/migrations/033_creator_artwork_foundation.sql', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../../backend/platform/src/creatorArtworks.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../backend/platform/src/app.ts', import.meta.url), 'utf8');

describe('creator artwork pagination helpers', () => {
  it('round-trips opaque cursor timestamps and UUID tie-breakers', () => {
    const row = { cursor_timestamp: new Date('2026-11-05T23:00:00.000Z'), cursor_id: '7a1fdf1d-87d7-4cb0-93cb-5b52a6f25f2a' };
    const cursor = encodePageCursor(row);
    assert.deepEqual(decodePageCursor(cursor), {
      timestamp: '2026-11-05T23:00:00.000Z',
      id: row.cursor_id,
    });
  });

  it('rejects malformed and oversized cursors', () => {
    assert.throws(() => decodePageCursor('not-a-cursor'));
    assert.throws(() => decodePageCursor('x'.repeat(513)));
  });

  it('returns only the requested page and a cursor for the last visible row', () => {
    const items = [
      { value: 1, cursor_timestamp: '2026-11-05T23:00:00.000Z', cursor_id: '7a1fdf1d-87d7-4cb0-93cb-5b52a6f25f2a' },
      { value: 2, cursor_timestamp: '2026-11-04T23:00:00.000Z', cursor_id: '7a1fdf1d-87d7-4cb0-93cb-5b52a6f25f2b' },
      { value: 3, cursor_timestamp: '2026-11-03T23:00:00.000Z', cursor_id: '7a1fdf1d-87d7-4cb0-93cb-5b52a6f25f2c' },
    ];
    const result = pageResult(items, 2);
    assert.deepEqual(result.items.map(item => item.value), [1, 2]);
    assert.deepEqual(decodePageCursor(result.nextCursor), {
      timestamp: '2026-11-04T23:00:00.000Z',
      id: items[1]!.cursor_id,
    });
    assert.equal(pageResult(items.slice(0, 2), 2).nextCursor, null);
  });
});

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
    assert.match(routes, /PUBLIC_VISIBILITY_CONFIRMATION_REQUIRED/);
    assert.match(routes, /CREATOR_ACCOUNT_RESTRICTED/);
  });

  it('keeps public discovery restricted to active approved works and verified creators', () => {
    assert.match(routes, /a\.public_active AND a\.status='APPROVED' AND c\.profile_status='VERIFIED'/);
    assert.match(routes, /status='READY_FOR_REVIEW'/);
  });


  it('prevents unreviewed edits from demoting or silently changing verified creator profiles', () => {
    assert.match(routes, /Verified profiles are locked against direct edits/);
    assert.match(routes, /!\['DRAFT','CHANGES_REQUESTED'\]\.includes\(String\(old\.profile_status\)\)/);
  });

  it('uses stable opaque keyset cursors for creator, moderation and public discovery lists', () => {
    assert.match(routes, /function decodePageCursor/);
    assert.match(routes, /function encodePageCursor/);
    assert.match(routes, /Buffer\\.from\\(JSON\\.stringify\\(/);
    assert.match(routes, /base64url/);
    assert.match(routes, /updated_at,artwork_id\)<\(\$3::timestamptz,\$4::uuid\)/);
    assert.match(routes, /submitted_at,artwork_id\)<\(\$2::timestamptz,\$3::uuid\)/);
    assert.match(routes, /a\.published_at,a\.artwork_id\)<\(\$3::timestamptz,\$4::uuid\)/);
    assert.match(routes, /nextCursor:page\.nextCursor/);
    assert.match(routes, /INVALID_CURSOR/);
  });

  it('supports creator media management and public takedown', () => {
    assert.match(routes, /media\/reorder/);
    assert.match(routes, /cover_selected/);
    assert.match(routes, /creator_artwork_media\.removed/);
    assert.match(routes, /creator_artwork\.withdrawn/);
    assert.match(routes, /creator_artwork\.taken_down/);
  });
});
