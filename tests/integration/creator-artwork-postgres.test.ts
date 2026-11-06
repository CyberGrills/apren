import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type * as C from '@7even/contracts';
import { createApp } from '../../backend/platform/src/app.ts';
import { createPool, one } from '../../backend/platform/src/db.ts';
import { migrate } from '../../backend/platform/src/migrate.ts';
import { seed } from '../../backend/platform/src/seed.ts';

const origin = 'http://localhost:5177';
const password = 'Integration-only-passphrase-42!';

interface ApiResult<T> {
  status: number;
  data: T;
  error?: { code: string; message: string };
}

class Client {
  cookie = '';
  csrf = '';
  constructor(private readonly base: string) {}

  async request<T>(path: string, method = 'GET', body?: unknown, key = randomUUID()): Promise<ApiResult<T>> {
    const response = await fetch(this.base + '/api' + path, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: this.cookie,
        'X-CSRF-Token': this.csrf,
        'Idempotency-Key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const cookie = response.headers.get('set-cookie');
    if (cookie) this.cookie = cookie.split(';')[0]!;
    const payload = await response.json() as { data: T; error?: { code: string; message: string } };
    return { status: response.status, ...payload };
  }

  async login(email: string): Promise<C.SessionUser> {
    const result = await this.request<C.SessionData>('/auth/login', 'POST', { email, password });
    assert.equal(result.status, 200, JSON.stringify(result));
    this.csrf = result.data.csrfToken!;
    return result.data.user!;
  }
}

test('7EVEN creator artwork PostgreSQL migration and API isolation', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 120000,
}, async (t) => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  const database = await one(pool, 'SELECT current_database() AS name');
  assert.match(String(database?.name), /_test_db$/, 'Creator artwork tests require a disposable *_test_db database.');

  await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
  await migrate(pool);
  await seed(pool, password);

  const migrationState = await one<{
    profile_rls: boolean;
    artwork_rls: boolean;
    media_rls: boolean;
    profile_app: boolean;
    artwork_readonly: boolean;
  }>(pool, `
    SELECT
      (SELECT relrowsecurity FROM pg_class WHERE oid='seven.creator_profiles'::regclass) AS profile_rls,
      (SELECT relrowsecurity FROM pg_class WHERE oid='seven.creator_artworks'::regclass) AS artwork_rls,
      (SELECT relrowsecurity FROM pg_class WHERE oid='seven.creator_artwork_media'::regclass) AS media_rls,
      has_table_privilege('seven_app','seven.creator_profiles','SELECT,INSERT,UPDATE') AS profile_app,
      has_table_privilege('seven_readonly','seven.creator_artworks','SELECT') AS artwork_readonly
  `);
  assert.equal(migrationState?.profile_rls, true);
  assert.equal(migrationState?.artwork_rls, true);
  assert.equal(migrationState?.media_rls, true);
  assert.equal(migrationState?.profile_app, true);
  assert.equal(migrationState?.artwork_readonly, true);
  const storageCatalog = await one<{ buckets_table: string | null }>(pool, "SELECT to_regclass('storage.buckets')::text AS buckets_table");
  if (storageCatalog?.buckets_table) {
    const bucket = await one<{ is_private: boolean }>(pool, "SELECT NOT public AS is_private FROM storage.buckets WHERE id='creator-artwork-media'");
    assert.equal(bucket?.is_private, true, 'Creator artwork storage bucket must remain private.');
  }

  const runtimePool = process.env.TEST_RUNTIME_DATABASE_URL
    ? createPool(process.env.TEST_RUNTIME_DATABASE_URL)
    : pool;
  if (process.env.TEST_RUNTIME_DATABASE_URL) {
    const privileges = await one<{ schema_usage: boolean; app_privileges: boolean }>(runtimePool, "SELECT has_schema_privilege(current_user,'seven','USAGE') AS schema_usage, pg_has_role(current_user,'seven_app','USAGE') AS app_privileges");
    assert.equal(privileges?.schema_usage, true);
    assert.equal(privileges?.app_privileges, true);
  }
  const runtime = createApp({ pool: runtimePool, environment: 'test', publicOrigin: origin });
  const server = await new Promise<Server>((resolve) => {
    const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const creator = new Client(base);
  const otherUser = new Client(base);
  const admin = new Client(base);

  try {
    await creator.login('guest@seven.test');
    await otherUser.login('friend@seven.test');
    await admin.login('admin@seven.test');

    await t.test('creator profile writes are idempotent and conflicting replays are rejected', async () => {
      const key = randomUUID();
      const profile = {
        displayName: 'Uyo Test Creator',
        location: { city: 'Uyo', region: 'Akwa Ibom', countryCode: 'NG' },
        disciplines: ['DIGITAL_ART'],
        biography: 'An integration-test creator profile describing original digital artwork and visual storytelling.',
        portfolioUrls: [],
      };
      const first = await creator.request<{ creator: { creatorId: string; profileStatus: string } }>('/creator/profile', 'PUT', profile, key);
      assert.equal(first.status, 200, JSON.stringify(first));
      assert.equal(first.data.creator.profileStatus, 'DRAFT');

      const replay = await creator.request<{ creator: { creatorId: string } }>('/creator/profile', 'PUT', profile, key);
      assert.equal(replay.status, 200, JSON.stringify(replay));
      assert.equal(replay.data.creator.creatorId, first.data.creator.creatorId);

      const conflict = await creator.request('/creator/profile', 'PUT', { ...profile, displayName: 'Different Test Creator' }, key);
      assert.equal(conflict.status, 409, JSON.stringify(conflict));
      assert.equal(conflict.error?.code, 'IDEMPOTENCY_CONFLICT');
    });

    let artworkId = '';
    await t.test('creator artwork is persisted and inaccessible to a different account', async () => {
      const created = await creator.request<{ artwork: { artworkId: string; status: string } }>('/creator/artworks', 'POST', {
        title: 'Uyo Digital Pattern Study',
        discipline: 'DIGITAL_ART',
        description: 'A test artwork record used to verify creator ownership boundaries in PostgreSQL.',
        creationYear: 2026,
        origin: { city: 'Uyo', countryCode: 'NG' },
        culturalContext: 'Synthetic integration-test content; not a representation of a real community or tradition.',
        tags: ['integration-test'],
        accessibilityText: 'Abstract geometric pattern in a test artwork.',
        rights: {
          basis: 'ORIGINAL',
          rightsConfirmed: true,
          attributionText: 'Integration test fixture',
          thirdPartyPermissions: '',
          communityPermission: 'NOT_REQUIRED',
          displayLicense: 'ALL_RIGHTS_RESERVED',
        },
        contentNotice: { containsSensitiveCulturalMaterial: false, publicDisplayRestrictions: [] },
      });
      assert.equal(created.status, 201, JSON.stringify(created));
      artworkId = created.data.artwork.artworkId;
      assert.equal(created.data.artwork.status, 'DRAFT');

      const ownerRead = await creator.request<{ artwork: { artworkId: string } }>(`/creator/artworks/${artworkId}`);
      assert.equal(ownerRead.status, 200, JSON.stringify(ownerRead));
      assert.equal(ownerRead.data.artwork.artworkId, artworkId);

      const foreignRead = await otherUser.request(`/creator/artworks/${artworkId}`);
      assert.equal(foreignRead.status, 404, JSON.stringify(foreignRead));
      assert.equal(foreignRead.error?.code, 'ARTWORK_NOT_FOUND');
    });

    await t.test('upload intents reject unsupported media before storage is contacted', async () => {
      const result = await creator.request(`/creator/artworks/${artworkId}/media/upload-intents`, 'POST', {
        filename: 'payload.svg',
        mimeType: 'image/svg+xml',
        byteSize: 2048,
        caption: 'Unsupported vector',
        accessibilityText: 'An unsupported SVG upload test.',
        isCover: true,
      });
      assert.equal(result.status, 422, JSON.stringify(result));
    });

    await t.test('creator profile submission enters moderation and cannot be approved by a non-admin', async () => {
      const submitted = await creator.request<{ creatorId: string; profileStatus: string }>('/creator/profile/submit', 'POST', {});
      assert.equal(submitted.status, 202, JSON.stringify(submitted));
      assert.equal(submitted.data.profileStatus, 'PENDING_REVIEW');

      const forbidden = await creator.request('/admin/creator-submissions');
      assert.equal(forbidden.status, 403, JSON.stringify(forbidden));

      const queue = await admin.request<{ items: Array<{ submissionId: string; submissionType: string }> }>('/admin/creator-submissions?type=CREATOR_PROFILE');
      assert.equal(queue.status, 200, JSON.stringify(queue));
      assert.ok(queue.data.items.some((item) => item.submissionId === submitted.data.creatorId));
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (runtimePool !== pool) await runtimePool.end();
    await pool.end();
  }
});
