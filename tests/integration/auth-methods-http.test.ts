import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../services/platform/src/app.ts';
import { createPool } from '../../services/platform/src/db.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';

const origin = 'http://localhost:5177';
const configuration = [
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APPLE_CLIENT_ID', 'APPLE_TEAM_ID',
  'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'SEVEN_PREVIEW_READ_ONLY', 'VERCEL_ENV',
] as const;

test('new sign-in endpoints preserve HTTP trust boundaries', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 30000,
}, async t => {
  const previous = Object.fromEntries(configuration.map(key => [key, process.env[key]]));
  for (const key of configuration) delete process.env[key];
  const pool = createPool(process.env.TEST_DATABASE_URL);
  const { app } = createApp({ pool, publicOrigin: origin, environment: 'test', provider: new MockProvider() });
  const server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function request(path: string, requestOrigin?: string, method = 'POST') {
    return fetch(`${base}/api${path}`, {
      method, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...(requestOrigin ? { Origin: requestOrigin } : {}) },
      ...(method === 'GET' ? {} : { body: '{}' }),
    });
  }
  try {
    await t.test('advertises unavailable social providers without exposing configuration', async () => {
      const response = await request('/auth/methods', undefined, 'GET');
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data, {
        google: { enabled: false }, apple: { enabled: false }, passkeys: { enabled: true },
      });
    });
    await t.test('rejects missing or foreign origins on every new ordinary POST', async () => {
      for (const path of [
        '/auth/passkeys/authentication/options', '/auth/passkeys/authentication/verify',
        '/auth/passkeys/registration/options', '/auth/passkeys/registration/verify',
        '/auth/social/google/start', '/auth/social/apple/start',
      ]) {
        for (const submitted of [undefined, 'https://attacker.invalid']) {
          const response = await request(path, submitted);
          assert.equal(response.status, 403, `${path} accepted ${submitted}`);
          assert.equal((await response.json()).error.code, 'ORIGIN_REJECTED');
          assert.equal(response.headers.get('set-cookie'), null);
        }
      }
    });
    await t.test('requires an account before passkey enrolment and management', async () => {
      for (const [path, method] of [
        ['/auth/passkeys', 'GET'],
        ['/auth/passkeys/registration/options', 'POST'],
        ['/auth/social/accounts', 'GET'],
      ]) {
        const response = await request(path!, origin, method);
        assert.equal(response.status, 401, `${method} ${path}`);
        assert.equal((await response.json()).error.code, 'AUTHENTICATION_REQUIRED');
      }
    });
    await t.test('keeps the Apple form callback exemption confined to its exact route', async () => {
      for (const path of ['/auth/social/google/callback', '/auth/social/apple/callback/other']) {
        const response = await request(path, 'https://appleid.apple.com');
        assert.equal(response.status, 403);
        assert.equal((await response.json()).error.code, 'ORIGIN_REJECTED');
      }
    });
    await t.test('read-only previews cannot process either provider callback', async () => {
      process.env.SEVEN_PREVIEW_READ_ONLY = 'true';
      process.env.VERCEL_ENV = 'preview';
      for (const [provider, method] of [['google', 'GET'], ['apple', 'POST']]) {
        const response = await request(`/auth/social/${provider}/callback`, 'https://appleid.apple.com', method);
        assert.equal(response.status, 503);
        assert.equal((await response.json()).error.code, 'PREVIEW_READ_ONLY');
        assert.equal(response.headers.get('set-cookie'), null);
      }
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
    for (const key of configuration) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
