import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const migration = readFileSync(new URL('../../database/migrations/032_business_media_gallery.sql', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../../services/platform/src/businessMedia.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../services/platform/src/app.ts', import.meta.url), 'utf8');

describe('business media gallery contract', () => {
  it('stores private photos with bounded image types and size', () => {
    assert.match(migration, /public,\s*file_size_limit,\s*allowed_mime_types/);
    assert.match(migration, /VALUES \('business-property-photos','business-property-photos',false,10485760/);
    assert.match(migration, /byte_size > 0 AND byte_size <= 10485760/);
    assert.match(migration, /image\/jpeg.*image\/png.*image\/webp.*image\/avif/s);
  });

  it('keeps photos hidden until moderation approves them', () => {
    assert.match(migration, /status = 'APPROVED'/);
    assert.match(migration, /seven_readonly_select_access/);
    assert.match(routes, /status='PENDING_REVIEW'/);
    assert.match(routes, /admin\.role !== 'ADMIN'/);
    assert.match(routes, /decision: z\.enum\(\['APPROVED','REJECTED'\]\)/);
  });

  it('enforces owner-scoped access, upload limits and image-content validation', () => {
    assert.match(routes, /actor\.role !== 'BUSINESS_OWNER' \|\| !actor\.businessId/);
    assert.match(routes, /business_id=\$1/);
    assert.match(routes, /UPLOAD_LIMIT_REACHED/);
    assert.match(routes, /validImageSignature/);
    assert.match(routes, /MAX_BYTES = 10 \* 1024 \* 1024/);
  });

  it('records moderation and gallery mutations in the append-only audit table', () => {
    assert.match(routes, /INSERT INTO seven\.audit_events/);
    assert.match(routes, /business_media\.reordered/);
    assert.match(routes, /business_media\.cover_selected/);
    assert.match(routes, /'business_media\.' \+ input\.decision\.toLowerCase\(\)/);
    assert.match(routes, /'business_media\.' \+ input\.decision\.toLowerCase\(\)/);
  });

  it('registers the feature in the existing platform service', () => {
    assert.match(app, /import \{ businessMediaGallery, mountBusinessMedia \} from '\.\/businessMedia\.ts'/);
    assert.match(app, /mountBusinessMedia\(app, \{ pool, actor: actorFor \}\)/);
  });
});
