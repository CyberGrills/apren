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
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith('https://storage.test/storage/v1/object/upload/sign/')) {
      return new Response(JSON.stringify({ signedURL: '/object/upload/sign/customer-profile-photos/synthetic', token: 'synthetic-signed-upload-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  };
  const runtime = createApp({ pool, provider: new MockProvider(), environment: 'test', publicOrigin: origin });
  const server = await new Promise<Server>(resolve => {
    const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

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
      const uploadBody = await upload.json() as { data?: { mediaId: string; token: string; uploadUrl: string }; error?: { code: string } };
      assert.equal(upload.status, 201, `${role} account should create its own upload intent: ${JSON.stringify(uploadBody)}`);
      assert.equal(uploadBody.data?.token, 'synthetic-signed-upload-token');
      assert.match(uploadBody.data?.uploadUrl ?? '', /^https:\/\/storage\.test\/storage\/v1\//);
      const pending = await one(pool, 'SELECT user_id,status FROM seven.customer_profile_media WHERE media_id=$1', [uploadBody.data?.mediaId]);
      assert.equal(pending?.user_id, userId, 'Avatar uploads must be scoped to the authenticated account');
      assert.equal(pending?.status, 'PENDING_UPLOAD');
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
