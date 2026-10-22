import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AuthenticationResponseJSON, RegistrationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import type { SessionData } from '@7even/contracts';
import { createPool, one, rows } from '../../services/platform/src/db.ts';
import { createApp } from '../../services/platform/src/app.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { hashPassword, digestToken } from '../../services/platform/src/auth.ts';
import { passkeysEnabled } from '../../services/platform/src/passkeys.ts';

const origin = 'http://localhost:5177';
const password = 'Passkey-synthetic-account-42!';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest();
const required = <T>(value: T | undefined): T => { assert.ok(value); return value; };
interface Credential { id: string; key: KeyObject; cose: Uint8Array<ArrayBuffer>; userId: string }
interface Passkey { id: string; name: string; createdAt: string; lastUsedAt: string | null }
function credential(userId: string): Credential {
  const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = key.publicKey.export({ format: 'jwk' });
  const cose = isoCBOR.encode(new Map<number, number | Uint8Array>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(required(jwk.x), 'base64url')], [-3, Buffer.from(required(jwk.y), 'base64url')]]));
  return { id: randomBytes(32).toString('base64url'), key: key.privateKey, cose, userId };
}
function registration(key: Credential, challenge: string, overrides: { origin?: string; rp?: string; uv?: boolean; crossOrigin?: boolean } = {}): RegistrationResponseJSON {
  const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin: overrides.origin ?? origin, crossOrigin: overrides.crossOrigin ?? false })).toString('base64url');
  const id = Buffer.from(key.id, 'base64url'); const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
  const flags = Buffer.from([overrides.uv === false ? 0x41 : 0x45]);
  const authData = Buffer.concat([hash(overrides.rp ?? 'localhost'), flags, Buffer.alloc(4), Buffer.alloc(16), length, id, key.cose]);
  const attestationObject = Buffer.from(isoCBOR.encode(new Map<string, string | Uint8Array | Map<string, string>>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))).toString('base64url');
  return { id: key.id, rawId: key.id, type: 'public-key', response: { clientDataJSON, attestationObject, transports: ['internal'] }, clientExtensionResults: { credProps: { rk: true } } };
}
function authentication(key: Credential, challenge: string, counter = 0, overrides: { origin?: string; rp?: string; uv?: boolean; userHandle?: string; signature?: string; crossOrigin?: boolean } = {}): AuthenticationResponseJSON {
  const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: overrides.origin ?? origin, crossOrigin: overrides.crossOrigin ?? false }));
  const count = Buffer.alloc(4); count.writeUInt32BE(counter);
  const authenticatorData = Buffer.concat([hash(overrides.rp ?? 'localhost'), Buffer.from([overrides.uv === false ? 0x01 : 0x05]), count]);
  const signature = sign('sha256', Buffer.concat([authenticatorData, hash(clientData)]), key.key).toString('base64url');
  return { id: key.id, rawId: key.id, type: 'public-key', response: { clientDataJSON: clientData.toString('base64url'), authenticatorData: authenticatorData.toString('base64url'), signature: overrides.signature ?? signature, userHandle: overrides.userHandle ?? Buffer.from(key.userId).toString('base64url') }, clientExtensionResults: {} };
}

test('passkeys require a canonical HTTPS domain or local localhost origin', () => {
  for (const value of ['https://seven.example.test', 'https://localhost:5177', 'http://localhost:5177']) assert.equal(passkeysEnabled(value), true);
  for (const value of ['http://127.0.0.1:5177', 'https://127.0.0.1', 'http://[::1]:5177', 'https://[::1]', 'https://[::ffff:192.0.2.1]', 'https://2130706433', 'http://seven.example.test', 'https://seven.example.test/path', 'https://seven.example.test/', 'invalid']) assert.equal(passkeysEnabled(value), false);
});

test('IP-address passkey requests stop before challenge generation and return an actionable message', async () => {
  for (const publicOrigin of ['http://127.0.0.1:5177', 'https://127.0.0.1', 'https://[::1]']) {
    const pool = createPool('postgresql://unused:unused@127.0.0.1:1/unused_test_db');
    const runtime = createApp({ pool, provider: new MockProvider(), environment: 'test', publicOrigin });
    const server = await new Promise<Server>(resolve => { const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const methods = await fetch(`${base}/api/auth/methods`);
      assert.equal((await methods.json() as { data: { passkeys: { enabled: boolean } } }).data.passkeys.enabled, false);
      const response = await fetch(`${base}/api/auth/passkeys/authentication/options`, { method: 'POST', headers: { Origin: publicOrigin, 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 503);
      const body = await response.json() as { error: { code: string; message: string } };
      assert.equal(body.error.code, 'PASSKEY_UNAVAILABLE'); assert.match(body.error.message, /secure website address/); assert.match(body.error.message, /localhost/);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await pool.end();
    }
  }
});

test('passkey registration and authentication use real signatures and shared PostgreSQL state', { skip: !process.env.TEST_DATABASE_URL, timeout: 120000 }, async t => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  assert.match((await one(pool, 'SELECT current_database() AS db'))?.db, /_test_db$/);
  await migrate(pool);
  const servers: Server[] = [];
  async function start(): Promise<string> {
    const runtime = createApp({ pool, provider: new MockProvider(), environment: 'test', publicOrigin: origin });
    const server = await new Promise<Server>(resolve => { const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener)); });
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }
  const base = await start();
  class Browser {
    cookies = new Map<string, string>(); csrf = '';
    async request<T>(path: string, body?: unknown, method = 'POST', options: { origin?: string; csrf?: string; base?: string } = {}): Promise<{ status: number; data: T; error?: { code: string }; setCookies: string[] }> {
      const response = await fetch(`${options.base ?? base}/api${path}`, { method, headers: { Origin: options.origin ?? origin, 'Content-Type': 'application/json', Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '), 'X-CSRF-Token': options.csrf ?? this.csrf }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const setCookies = response.headers.getSetCookie();
      for (const cookie of setCookies) { const pair = required(cookie.split(';')[0]); const i = pair.indexOf('='); if (pair.slice(i + 1)) this.cookies.set(pair.slice(0, i), pair.slice(i + 1)); else this.cookies.delete(pair.slice(0, i)); }
      const payload = await response.json() as { data: T; error?: { code: string } };
      if (payload.data && typeof payload.data === 'object' && 'csrfToken' in payload.data) this.csrf = typeof payload.data.csrfToken === 'string' ? payload.data.csrfToken : '';
      return { status: response.status, ...payload, setCookies };
    }
  }
  async function user(): Promise<{ id: string; email: string; browser: Browser }> {
    const id = randomUUID(); const email = `passkey-${id}@seven.test`;
    await pool.query("INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id) VALUES($1,$2,'Synthetic passkey fixture',$3,(SELECT role_id FROM seven.roles WHERE role_code='CUSTOMER'))", [id, email, await hashPassword(password)]);
    const browser = new Browser(); assert.equal((await browser.request('/auth/login', { email, password })).status, 200);
    return { id, email, browser };
  }
  async function enroll(account: { id: string; browser: Browser }, name = 'Test device'): Promise<{ key: Credential; saved: Passkey }> {
    const key = credential(account.id);
    const options = await account.browser.request<PublicKeyCredentialCreationOptionsJSON>('/auth/passkeys/registration/options', {});
    assert.equal(options.status, 200); assert.equal(options.data.authenticatorSelection?.residentKey, 'required'); assert.equal(options.data.authenticatorSelection?.userVerification, 'required');
    assert.equal(options.data.rp.id, 'localhost'); assert.equal(options.data.user.id, Buffer.from(account.id).toString('base64url'));
    assert.ok(options.setCookies.some(cookie => cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict')));
    const result = await account.browser.request<Passkey>('/auth/passkeys/registration/verify', { name, response: registration(key, options.data.challenge) });
    assert.equal(result.status, 200, JSON.stringify(result));
    return { key, saved: result.data };
  }
  async function signIn(key: Credential, counter = 0, overrides: Parameters<typeof authentication>[3] = {}) {
    const browser = new Browser(); const options = await browser.request<PublicKeyCredentialRequestOptionsJSON>('/auth/passkeys/authentication/options', {});
    assert.equal(options.status, 200); assert.equal(options.data.userVerification, 'required'); assert.equal(options.data.allowCredentials?.length ?? 0, 0, 'Discoverable login does not enumerate accounts');
    const response = authentication(key, options.data.challenge, counter, overrides);
    return { browser, options: options.data, response, result: await browser.request<SessionData>('/auth/passkeys/authentication/verify', { response }) };
  }
  async function revokeAfterMiddleware<T>(userId: string, request: () => Promise<T>): Promise<T> {
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT user_id FROM seven.users WHERE user_id=$1 FOR UPDATE', [userId]);
      const blockerPid = required(await one(blocker, 'SELECT pg_backend_pid() AS pid')).pid;
      const pending = request();
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        waiting = Boolean((await one(pool, "SELECT 1 AS waiting FROM pg_stat_activity WHERE datname=current_database() AND $1::int=ANY(pg_blocking_pids(pid)) AND wait_event_type='Lock'", [blockerPid]))?.waiting);
        if (waiting) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true, 'The request has passed session middleware and is waiting for the account row lock');
      await blocker.query('DELETE FROM seven.sessions WHERE user_id=$1', [userId]);
      await blocker.query('COMMIT');
      return await pending;
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
  }
  t.beforeEach(async () => { await pool.query('TRUNCATE seven.account_rate_limits'); });
  try {
    await t.test('enrolls a public key, performs verified sign-in and keeps private material out of storage and responses', async () => {
      const account = await user(); const { key, saved } = await enroll(account, 'My laptop');
      assert.equal(saved.name, 'My laptop'); assert.equal(saved.lastUsedAt, null);
      const stored = required(await one(pool, 'SELECT * FROM seven.passkeys WHERE passkey_id=$1', [saved.id]));
      assert.equal(Buffer.from(stored.public_key).equals(Buffer.from(key.cose)), true); assert.equal(stored.credential_id, key.id);
      assert.equal(JSON.stringify(stored).includes(key.key.export({ type: 'pkcs8', format: 'pem' }).toString()), false);
      const signed = await signIn(key); assert.equal(signed.result.status, 200, JSON.stringify(signed.result)); assert.equal(signed.result.data.user?.id, account.id);
      assert.ok(signed.result.data.csrfToken); assert.ok(signed.browser.cookies.get('seven_session'));
      const list = await signed.browser.request<{ passkeys: Passkey[] }>('/auth/passkeys', undefined, 'GET');
      assert.deepEqual(Object.keys(required(list.data.passkeys[0])).sort(), ['createdAt', 'id', 'lastUsedAt', 'name']); assert.ok(required(list.data.passkeys[0]).lastUsedAt);
      assert.equal((await signed.browser.request('/auth/passkeys/authentication/verify', { response: signed.response })).status, 400, 'Challenge cannot be replayed');
      assert.equal((await signIn(key)).result.status, 200, 'Synced zero-counter credentials remain usable with fresh proofs');
    });
    await t.test('rejects invalid signatures, wrong origin, wrong RP, missing verification and wrong user handle without creating sessions', async () => {
      const account = await user(); const { key } = await enroll(account);
      const before = required(await one(pool, 'SELECT count(*)::int AS count FROM seven.sessions WHERE user_id=$1', [account.id])).count;
      const tampering = [{ signature: randomBytes(64).toString('base64url') }, { origin: 'https://evil.example.test' }, { rp: 'evil.example.test' }, { uv: false }, { userHandle: Buffer.from(randomUUID()).toString('base64url') }, { crossOrigin: true }];
      for (const override of tampering) assert.equal((await signIn(key, 0, override)).result.status, 400);
      assert.equal(required(await one(pool, 'SELECT count(*)::int AS count FROM seven.sessions WHERE user_id=$1', [account.id])).count, before);
    });
    await t.test('requires the browser binding, rejects expired and failed challenges, and survives another server instance', async () => {
      const account = await user(); const { key } = await enroll(account);
      const browser = new Browser(); const options = await browser.request<PublicKeyCredentialRequestOptionsJSON>('/auth/passkeys/authentication/options', {});
      const response = authentication(key, options.data.challenge);
      assert.equal((await new Browser().request('/auth/passkeys/authentication/verify', { response })).status, 400);
      const secondBase = await start(); const verified = await browser.request<SessionData>('/auth/passkeys/authentication/verify', { response }, 'POST', { base: secondBase });
      assert.equal(verified.status, 200); assert.equal(verified.data.user?.id, account.id);
      const expired = new Browser(); const expiredOptions = await expired.request<PublicKeyCredentialRequestOptionsJSON>('/auth/passkeys/authentication/options', {});
      await pool.query("UPDATE seven.passkey_challenges SET expires_at=now()-interval '1 second' WHERE binding_hash=$1", [digestToken(required(expired.cookies.get('seven_passkey_authentication')))]);
      assert.equal((await expired.request('/auth/passkeys/authentication/verify', { response: authentication(key, expiredOptions.data.challenge) })).status, 400);
      const failed = new Browser(); const failedOptions = await failed.request<PublicKeyCredentialRequestOptionsJSON>('/auth/passkeys/authentication/options', {}); const binding = required(failed.cookies.get('seven_passkey_authentication'));
      assert.equal((await failed.request('/auth/passkeys/authentication/verify', { response: authentication(key, failedOptions.data.challenge, 0, { uv: false }) })).status, 400);
      assert.equal(required(await one(pool, 'SELECT count(*)::int AS count FROM seven.passkey_challenges WHERE binding_hash=$1', [digestToken(binding)])).count, 0);
      failed.cookies.set('seven_passkey_authentication', binding);
      assert.equal((await failed.request('/auth/passkeys/authentication/verify', { response: authentication(key, failedOptions.data.challenge) })).status, 400);
    });
    await t.test('a concurrent challenge creates one session and nonzero counters cannot roll back', async () => {
      const account = await user(); const { key } = await enroll(account);
      const browser = new Browser(); const options = await browser.request<PublicKeyCredentialRequestOptionsJSON>('/auth/passkeys/authentication/options', {});
      const attempts = await Promise.all(Array.from({ length: 10 }, () => {
        const concurrent = new Browser(); concurrent.cookies = new Map(browser.cookies);
        return concurrent.request<SessionData>('/auth/passkeys/authentication/verify', { response: authentication(key, options.data.challenge, 1) });
      }));
      assert.equal(attempts.filter(result => result.status === 200).length, 1); assert.equal(attempts.filter(result => result.status === 400).length, 9);
      assert.equal((await signIn(key, 1)).result.status, 400); assert.equal((await signIn(key, 0)).result.status, 400); assert.equal((await signIn(key, 2)).result.status, 200);
      assert.equal(required(await one(pool, 'SELECT signature_counter FROM seven.passkeys WHERE credential_id=$1', [key.id])).signature_counter, '2');
      const first = new Browser(); const second = new Browser();
      const firstOptions = await first.request<PublicKeyCredentialRequestOptionsJSON>('/auth/passkeys/authentication/options', {});
      const secondOptions = await second.request<PublicKeyCredentialRequestOptionsJSON>('/auth/passkeys/authentication/options', {});
      const collision = await Promise.all([first.request('/auth/passkeys/authentication/verify', { response: authentication(key, firstOptions.data.challenge, 3) }), second.request('/auth/passkeys/authentication/verify', { response: authentication(key, secondOptions.data.challenge, 3) })]);
      assert.equal(collision.filter(result => result.status === 200).length, 1, 'Credential row locks serialize competing proofs with the same nonzero counter');
      assert.equal(collision.filter(result => result.status === 400).length, 1);
    });
    await t.test('inactive users cannot sign in even with valid cryptographic proof', async () => {
      const account = await user(); const { key } = await enroll(account);
      await pool.query('UPDATE seven.users SET is_active=false WHERE user_id=$1', [account.id]);
      assert.equal((await signIn(key)).result.status, 401);
    });
    await t.test('registration rejects mismatched origin, RP, verification and another account challenge', async () => {
      const account = await user(); const stranger = await user();
      for (const override of [{ origin: 'https://evil.example.test' }, { rp: 'evil.example.test' }, { uv: false }, { crossOrigin: true }]) {
        const options = await account.browser.request<PublicKeyCredentialCreationOptionsJSON>('/auth/passkeys/registration/options', {});
        assert.equal((await account.browser.request('/auth/passkeys/registration/verify', { name: 'Invalid', response: registration(credential(account.id), options.data.challenge, override) })).status, 400);
      }
      const options = await account.browser.request<PublicKeyCredentialCreationOptionsJSON>('/auth/passkeys/registration/options', {});
      stranger.browser.cookies.set('seven_passkey_registration', required(account.browser.cookies.get('seven_passkey_registration')));
      assert.equal((await stranger.browser.request('/auth/passkeys/registration/verify', { name: 'Stolen', response: registration(credential(stranger.id), options.data.challenge) })).status, 400);
      assert.equal((await rows(pool, 'SELECT passkey_id FROM seven.passkeys WHERE user_id=ANY($1::uuid[])', [[account.id, stranger.id]])).length, 0);
    });
    await t.test('management requires recent sign-in and CSRF, scopes ownership and protects the final usable method', async () => {
      const account = await user(); const other = await user(); const { saved } = await enroll(account);
      assert.equal((await new Browser().request('/auth/passkeys', undefined, 'GET')).status, 401);
      assert.equal((await account.browser.request('/auth/passkeys/registration/options', {}, 'POST', { csrf: '' })).status, 403);
      assert.equal((await account.browser.request('/auth/passkeys/authentication/options', {}, 'POST', { csrf: '' })).status, 403, 'An existing account session retains CSRF protection');
      assert.equal((await other.browser.request(`/auth/passkeys/${saved.id}`, {}, 'DELETE')).status, 404);
      assert.equal((await account.browser.request(`/auth/passkeys/${saved.id}`, {}, 'DELETE')).status, 409);
      assert.equal((await account.browser.request(`/auth/passkeys/${saved.id}`, { currentPassword: 'Wrong-password-44!' }, 'DELETE')).status, 409);
      await pool.query("UPDATE seven.sessions SET created_at=now()-interval '11 minutes' WHERE user_id=$1", [account.id]);
      assert.equal((await account.browser.request('/auth/passkeys/registration/options', {})).status, 401);
      assert.equal((await account.browser.request(`/auth/passkeys/${saved.id}`, { currentPassword: password }, 'DELETE')).status, 401);
      assert.equal((await account.browser.request('/auth/login', { email: account.email, password })).status, 200);
      assert.equal((await account.browser.request(`/auth/passkeys/${saved.id}`, { currentPassword: password }, 'DELETE')).status, 200);
      assert.equal((await rows(pool, 'SELECT passkey_id FROM seven.passkeys WHERE user_id=$1', [account.id])).length, 0);
    });
    await t.test('external-only users can remove a passkey when a verified provider remains and no duplicate credential can be linked', async () => {
      const account = await user(); const { saved, key } = await enroll(account); const other = await user();
      const options = await other.browser.request<PublicKeyCredentialCreationOptionsJSON>('/auth/passkeys/registration/options', {});
      assert.equal((await other.browser.request('/auth/passkeys/registration/verify', { name: 'Duplicate', response: registration(key, options.data.challenge) })).status, 409);
      await pool.query("UPDATE seven.users SET password_hash='external' WHERE user_id=$1", [account.id]);
      assert.equal((await account.browser.request(`/auth/passkeys/${saved.id}`, { currentPassword: password }, 'DELETE')).status, 409);
      await pool.query("INSERT INTO seven.social_auth_identities(identity_id,user_id,provider_code,provider_subject) VALUES($1,$2,'google',$3)", [randomUUID(), account.id, randomUUID()]);
      assert.equal((await account.browser.request(`/auth/passkeys/${saved.id}`, {}, 'DELETE')).status, 200);
    });
    await t.test('revoking a session after middleware reads it prevents in-flight passkey enrollment', async () => {
      const account = await user(); const key = credential(account.id);
      const options = await account.browser.request<PublicKeyCredentialCreationOptionsJSON>('/auth/passkeys/registration/options', {});
      const result = await revokeAfterMiddleware(account.id, () => account.browser.request('/auth/passkeys/registration/verify', { name: 'Revoked device', response: registration(key, options.data.challenge) }));
      assert.equal(result.status, 401); assert.equal(result.error?.code, 'REAUTHENTICATION_REQUIRED');
      assert.equal((await rows(pool, 'SELECT passkey_id FROM seven.passkeys WHERE user_id=$1', [account.id])).length, 0);
    });
    await t.test('revoking a session after middleware reads it prevents in-flight passkey deletion', async () => {
      const account = await user(); const { saved } = await enroll(account);
      const result = await revokeAfterMiddleware(account.id, () => account.browser.request(`/auth/passkeys/${saved.id}`, { currentPassword: password }, 'DELETE'));
      assert.equal(result.status, 401); assert.equal(result.error?.code, 'REAUTHENTICATION_REQUIRED');
      assert.equal((await rows(pool, 'SELECT passkey_id FROM seven.passkeys WHERE passkey_id=$1 AND user_id=$2', [saved.id, account.id])).length, 1);
    });
    await t.test('public options are throttled durably and reject other HTTP origins', async () => {
      const browser = new Browser();
      assert.equal((await browser.request('/auth/passkeys/authentication/options', {}, 'POST', { origin: 'https://evil.example.test' })).status, 403);
      for (let count = 0; count < 15; count++) assert.equal((await browser.request('/auth/passkeys/authentication/options', {})).status, 200);
      assert.equal((await browser.request('/auth/passkeys/authentication/options', {})).status, 429);
      assert.equal(required(await one(pool, 'SELECT count(*)::int AS count FROM seven.passkey_challenges WHERE binding_hash=$1', [digestToken(required(browser.cookies.get('seven_passkey_authentication')))])).count, 1, 'A browser has one outstanding challenge per purpose');
    });
  } finally {
    await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
    await pool.end();
  }
});
