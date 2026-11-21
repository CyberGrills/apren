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

      const response = await fetch(`${base}/api/me/avatar`, { headers: { Cookie: cookie } });
      const body = await response.json() as { data?: { imageUrl: string | null }; error?: { code: string } };
      assert.equal(response.status, 200, `${role} account should read its own avatar: ${JSON.stringify(body)}`);
      assert.deepEqual(body, { data: { imageUrl: null } });
    }

    const guest = await fetch(`${base}/api/me/avatar`);
    assert.equal(guest.status, 401, 'Unauthenticated visitors must not access profile media');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
