import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPool, one } from '../../backend/platform/src/db.ts';
import { migrate } from '../../backend/platform/src/migrate.ts';
import { createApp } from '../../backend/platform/src/app.ts';
import { MockProvider } from '../../backend/platform/src/provider.ts';
import { hashPassword } from '../../backend/platform/src/auth.ts';

const origin = 'http://localhost:5177';
const password = 'Profile-avatar-test-passphrase-42!';
const roles = ['CUSTOMER', 'BUSINESS_OWNER', 'RECEPTION', 'ADMIN'] as const;

test('profile avatars are available to every authenticated 7even account role', { skip: !process.env.TEST_DATABASE_URL, timeout: 120000 }, async () => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  assert.match((await one(pool, 'SELECT current_database() AS db'))?.db, /_test_db$/);
  await migrate(pool);
  const previousUrl = process.env.SUPABASE_URL;
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://storage.test';
  process.env.SUPABASE_SECRET_KEY = 'synthetic-storage-secret';
  const storageObjects = new Map<string, Buffer>();
  globalThis.fetch = async (input, init = {}) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const uploadPrefix = 'https://storage.test/storage/v1/object/upload/sign/';
    if (method === 'POST' && url.startsWith(uploadPrefix)) {
      const objectPath = url.slice(uploadPrefix.length);
      return new Response(JSON.stringify({ url: '/object/upload/sign/' + objectPath + '?token=synthetic-signed-upload-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (method === 'PUT' && url.startsWith(uploadPrefix)) {
      const objectPath = url.slice(uploadPrefix.length).split('?')[0] ?? '';
      const bytes = Buffer.from(await new Response(init.body).arrayBuffer());
      storageObjects.set(objectPath, bytes);
      return new Response(null, { status: 200 });
    }
    const objectPrefix = 'https://storage.test/storage/v1/object/';
    if (method === 'POST' && url.startsWith(objectPrefix + 'sign/')) {
      const objectPath = url.slice((objectPrefix + 'sign/').length);
      if (!storageObjects.has(objectPath)) return new Response('Not found', { status: 404 });
      return new Response(JSON.stringify({ signedURL: '/object/sign/' + objectPath + '?token=synthetic-signed-view-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.startsWith(objectPrefix) && !url.startsWith(uploadPrefix)) {
      const objectPath = url.slice(objectPrefix.length);
      const stored = storageObjects.get(objectPath);
      if (!stored) return new Response('Not found', { status: 404 });
      if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'Content-Length': String(stored.length), 'Content-Type': 'image/png' } });
      if (method === 'GET') return new Response(stored.subarray(0, 32), { status: 206, headers: { 'Content-Length': '32', 'Content-Type': 'image/png', 'Content-Range': 'bytes 0-31/' + stored.length } });
      if (method === 'DELETE') { storageObjects.delete(objectPath); return new Response(null, { status: 204 }); }
    }
    return originalFetch(input, init);
  };
  const runtime = createApp({ pool, provider: new MockProvider(), environment: 'test', publicOrigin: origin });
  const server = await new Promise<Server>(resolve => {
    const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  let firstMediaId: string | null = null;
  try {
    for (const role of roles) {
      const userId = randomUUID();
      const email = `profile-avatar-${role.toLowerCase()}-${userId}@seven.test`;
      await pool.query(
        'INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id) VALUES($1,$2,$3,$4,(SELECT role_id FROM seven.roles WHERE role_code=$5))',
        [userId, email, 'Synthetic profile owner', await hashPassword(password), role],
      );
      const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(login.status, 200, `${role} account should sign in`);
      const cookie = login.headers.get('set-cookie')?.split(';')[0];
      assert.ok(cookie, `${role} login should establish a session`);
      const loginBody = await login.json() as { data?: { csrfToken?: string } };
      const csrfToken = loginBody.data?.csrfToken;
      assert.ok(csrfToken, `${role} login should provide a CSRF token`);

      const response = await fetch(`${base}/api/me/avatar`, { headers: { Cookie: cookie } });
      const body = await response.json() as { data?: { imageUrl: string | null }; error?: { code: string } };
      assert.equal(response.status, 200, `${role} account should read its own avatar: ${JSON.stringify(body)}`);
      assert.deepEqual(body, { data: { imageUrl: null } });

      const upload = await fetch(`${base}/api/me/avatar/upload-intents`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ filename: 'profile.png', mimeType: 'image/png', byteSize: 128 }),
      });
      const uploadBody = await upload.json() as { data?: { mediaId: string; uploadUrl: string }; error?: { code: string } };
      assert.equal(upload.status, 201, `${role} account should create its own upload intent: ${JSON.stringify(uploadBody)}`);
      const signedUploadUrl = new URL(uploadBody.data?.uploadUrl ?? 'https://invalid.test');
      assert.equal(signedUploadUrl.origin, 'https://storage.test');
      assert.equal(signedUploadUrl.searchParams.get('token'), 'synthetic-signed-upload-token');
      assert.equal('token' in (uploadBody.data ?? {}), false, 'The signed token belongs in the URL query, not an Authorization header payload');

      const image = Buffer.alloc(128);
      image.set([137,80,78,71,13,10,26,10], 0);
      const uploaded = await fetch(signedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: image,
      });
      assert.equal(uploaded.status, 200, 'The signed URL must accept the selected image bytes');

      if (firstMediaId) {
        const foreignOwnerAttempt = await fetch(`${base}/api/me/avatar/${firstMediaId}/complete`, {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({}),
        });
        assert.equal(foreignOwnerAttempt.status, 404, 'Another account role must not complete someone else’s avatar upload');
      } else {
        firstMediaId = uploadBody.data?.mediaId ?? null;
      }

      const complete = await fetch(`${base}/api/me/avatar/${uploadBody.data?.mediaId}/complete`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({}),
      });
      const completeBody = await complete.json() as { data?: { mediaId: string; imageUrl: string }; error?: { code: string } };
      assert.equal(complete.status, 200, `${role} account should complete its own image upload: ${JSON.stringify(completeBody)}`);
      assert.equal(completeBody.data?.mediaId, uploadBody.data?.mediaId);
      const signedViewUrl = new URL(completeBody.data?.imageUrl ?? 'https://invalid.test');
      assert.equal(signedViewUrl.origin, 'https://storage.test');
      assert.equal(signedViewUrl.searchParams.get('token'), 'synthetic-signed-view-token');

      const refreshed = await fetch(`${base}/api/me/avatar`, { headers: { Cookie: cookie } });
      const refreshedBody = await refreshed.json() as { data?: { imageUrl: string | null } };
      assert.equal(refreshed.status, 200);
      assert.equal(refreshedBody.data?.imageUrl, completeBody.data?.imageUrl, 'The signed image must be readable again from the authenticated profile');
      const current = await one(pool, "SELECT user_id,status FROM seven.customer_profile_media WHERE media_id=$1", [uploadBody.data?.mediaId]);
      assert.equal(current?.user_id, userId);
      assert.equal(current?.status, 'CURRENT');
    }

    const guest = await fetch(`${base}/api/me/avatar`);
    assert.equal(guest.status, 401, 'Unauthenticated visitors must not access profile media');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previousSecret;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
