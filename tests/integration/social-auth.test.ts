import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApp } from '../../services/platform/src/app.ts';
import { createPool, one, rows } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { digestToken, hashPassword } from '../../services/platform/src/auth.ts';
import { safeSocialReturnPath, verifySocialIdentityToken } from '../../services/platform/src/socialAuth.ts';
import type { SocialIdentity, SocialProvider, SocialProviderId } from '../../services/platform/src/socialAuth.ts';

const origin = 'http://localhost:5177';
const password = 'Social-fixture-passphrase-42!';

test('social return paths stay within the application', () => {
  for (const value of ['https://attacker.test', '//attacker.test', '/\\attacker.test', '/login', '/api/auth/session', '/\n/attacker.test']) assert.equal(safeSocialReturnPath(value), '/app');
  assert.equal(safeSocialReturnPath('/app/bookings?filter=next#today'), '/app/bookings?filter=next#today');
  assert.equal(safeSocialReturnPath('/admin'), '/admin', 'The destination does not grant a role; workspace guards still apply.');
});

test('the production OIDC verifier checks signed JWT issuer, audience, nonce, algorithm and lifetime', async t => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const attacker = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey); jwk.kid = 'fixture'; jwk.alg = 'RS256';
  const keys = createLocalJWKSet({ keys: [jwk] });
  const now = Math.floor(Date.now() / 1000);
  async function token(claims: Record<string, unknown> = {}, forged = false) {
    return new SignJWT({ iss: 'https://accounts.google.com', aud: 'fixture-client', sub: 'fixture-subject', iat: now, exp: now + 300, nonce: 'fixture-nonce', email: 'verified@seven.test', email_verified: true, ...claims }).setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).sign(forged ? attacker.privateKey : privateKey);
  }
  const verify = (value: string, provider: SocialProviderId = 'google') => verifySocialIdentityToken(value, provider, 'fixture-client', 'fixture-nonce', keys);
  await t.test('valid Google and Apple tokens retain provider subject and verified email', async () => {
    assert.deepEqual(await verify(await token()), { subject: 'fixture-subject', email: 'verified@seven.test', emailVerified: true, displayName: undefined });
    assert.equal((await verify(await token({ iss: 'https://appleid.apple.com', email_verified: 'true' }), 'apple')).emailVerified, true);
  });
  for (const [label, claims] of Object.entries({ issuer: { iss: 'https://attacker.test' }, audience: { aud: 'another-client' }, nonce: { nonce: 'another-nonce' }, expired: { exp: now - 1 }, stale: { iat: now - 601 }, future: { iat: now + 600 }, subject: { sub: '' }, authorizedParty: { azp: 'another-client' }, multipleAudiences: { aud: ['fixture-client', 'other-client'] } })) {
    await t.test(`rejects wrong ${label}`, async () => { await assert.rejects(verify(await token(claims))); });
  }
  await t.test('rejects forged signatures and unsigned tokens', async () => {
    await assert.rejects(verify(await token({}, true)));
    await assert.rejects(verify(`${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{}').toString('base64url')}.`));
  });
  await t.test('never upgrades an unverified or missing email claim', async () => {
    assert.equal((await verify(await token({ email_verified: false }))).emailVerified, false);
    assert.equal((await verify(await token({ email: 'malformed' }))).email, undefined);
    // Existing identities may sign in by verified provider subject without repeated email disclosure.
    // Creating a new account still requires emailVerified=true and a valid email in the callback.
    assert.equal((await verify(await token({ email_verified: undefined, email: undefined }))).emailVerified, false);
  });
});

test('social sign-in preserves browser binding, identities, linking and session authority in PostgreSQL', { skip: !process.env.TEST_DATABASE_URL, timeout: 120000 }, async t => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  assert.match((await one(pool, 'SELECT current_database() AS db'))?.db, /_test_db$/);
  await migrate(pool);
  const rateScopes = ['social:start:ip:127.0.0.1', 'social:callback:ip:127.0.0.1'].map(digestToken);
  await pool.query('DELETE FROM seven.account_rate_limits WHERE scope_hash=ANY($1::text[])', [rateScopes]);
  const identities = new Map<string, SocialIdentity>();
  const seenNonces = new Set<string>();
  const provider: SocialProvider = {
    authorizationUrl(input) { const url = new URL('https://provider.test/authorize'); url.search = new URLSearchParams({ state: input.state, nonce: input.nonce, redirect_uri: input.redirectUri }).toString(); seenNonces.add(input.nonce); return url.toString(); },
    async exchangeAndVerify(input) { assert.ok(seenNonces.has(input.nonce)); assert.match(input.codeVerifier, /^[A-Za-z0-9_-]{43}$/); const identity = identities.get(input.code); if (!identity) throw new Error('Synthetic provider failure; must never appear in redirect.'); return identity; },
  };
  const runtime = createApp({ pool, environment: 'test', publicOrigin: origin, provider: new MockProvider(), socialProviders: { google: provider, apple: provider } });
  const server = await new Promise<Server>(resolve => { const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const accountIds: string[] = [];
  async function request(path: string, body?: unknown, cookie = '', csrf = '') {
    const response = await fetch(`${base}/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrf }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual' });
    return { response, json: await response.json() as { data?: { url?: string; user?: { id: string }; csrfToken?: string; accounts?: { provider: string }[] }; error?: { code: string } }, cookie: response.headers.getSetCookie().find(value => value.startsWith('seven_session='))?.split(';')[0] ?? '' };
  }
  async function account(role = 'CUSTOMER') {
    const id = randomUUID(); const email = `social-existing-${id}@seven.test`; accountIds.push(id);
    await pool.query('INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id) VALUES($1,$2,$3,$4,(SELECT role_id FROM seven.roles WHERE role_code=$5))', [id, email, 'Social account fixture', await hashPassword(password), role]);
    return { id, email };
  }
  async function login(user: { email: string }) { return request('/auth/login', { email: user.email, password }); }
  async function start(provider: SocialProviderId = 'google', body: Record<string, unknown> = {}, cookie = '', csrf = '') {
    const started = await request(`/auth/social/${provider}/start`, body, cookie, csrf);
    assert.equal(started.response.status, 200, JSON.stringify(started.json));
    const url = new URL(started.json.data!.url!);
    return { state: url.searchParams.get('state')!, cookie: started.response.headers.getSetCookie()[0]!.split(';')[0]!, response: started.response, url };
  }
  function identity(email?: string, emailVerified = true) {
    const subject = `fixture-${randomUUID()}`; const code = randomUUID();
    identities.set(code, { subject, email: email ?? `social-new-${randomUUID()}@seven.test`, emailVerified, displayName: 'Synthetic social guest' });
    return { code, subject, email: identities.get(code)!.email! };
  }
  async function callback(flow: { state: string; cookie: string }, code: string, provider: SocialProviderId = 'google', cookie = flow.cookie) {
    return fetch(`${base}/api/auth/social/${provider}/callback${provider === 'google' ? `?${new URLSearchParams({ state: flow.state, code })}` : ''}`, {
      method: provider === 'google' ? 'GET' : 'POST', headers: { Cookie: cookie, ...(provider === 'apple' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      ...(provider === 'apple' ? { body: new URLSearchParams({ state: flow.state, code }) } : {}), redirect: 'manual',
    });
  }
  async function trackCreated(subject: string) { const row = await one(pool, 'SELECT user_id FROM seven.social_auth_identities WHERE provider_subject=$1', [subject]); if (row && !accountIds.includes(row.user_id)) accountIds.push(row.user_id); return row?.user_id as string | undefined; }
  try {
    await t.test('the methods endpoint exposes availability without credentials', async () => {
      const methods = await request('/auth/methods'); assert.equal(methods.response.status, 200);
      assert.equal(JSON.stringify(methods.json).includes('SECRET'), false);
    });
    await t.test('a state is browser bound, short-lived and cannot be forged', async () => {
      const flow = await start('google', { returnTo: '//attacker.test' }); const person = identity();
      assert.match(flow.response.headers.get('set-cookie')!, /HttpOnly/);
      const record = await one(pool, 'SELECT * FROM seven.social_auth_challenges WHERE state_hash=$1', [digestToken(flow.state)]);
      assert.notEqual(record?.state_hash, flow.state); assert.equal(record?.return_path, '/app'); assert.ok(new Date(record?.expires_at).getTime() <= Date.now() + 600001);
      assert.equal((await callback(flow, person.code, 'google', '')).headers.get('location'), '/login?authError=failed');
      assert.equal((await one(pool, 'SELECT used_at FROM seven.social_auth_challenges WHERE state_hash=$1', [digestToken(flow.state)]))?.used_at, null);
      const success = await callback(flow, person.code); assert.equal(success.headers.get('location'), '/app'); assert.ok(success.headers.getSetCookie().some(value => value.startsWith('seven_session=') && !value.startsWith('seven_session=;')));
      const userId = await trackCreated(person.subject); assert.ok(userId);
      const user = await one(pool, 'SELECT u.password_hash,r.role_code FROM seven.users u JOIN seven.roles r USING(role_id) WHERE user_id=$1', [userId]);
      assert.equal(user?.password_hash, 'external'); assert.equal(user?.role_code, 'CUSTOMER');
      assert.equal((await callback(flow, person.code)).headers.get('location'), '/login?authError=failed');
    });
    await t.test('ten concurrent callbacks produce one identity and one session', async () => {
      const flow = await start(); const person = identity();
      const results = await Promise.all(Array.from({ length: 10 }, () => callback(flow, person.code)));
      assert.equal(results.filter(result => result.headers.get('location') === '/app').length, 1);
      assert.equal(results.filter(result => result.headers.get('location') === '/login?authError=failed').length, 9);
      const userId = await trackCreated(person.subject); assert.ok(userId);
      assert.equal((await rows(pool, 'SELECT session_id FROM seven.sessions WHERE user_id=$1', [userId])).length, 1);
    });
    await t.test('expired state, a different provider and provider failure cannot create a session', async () => {
      const expired = await start(); const person = identity();
      await pool.query("UPDATE seven.social_auth_challenges SET expires_at=now()-interval '1 second' WHERE state_hash=$1", [digestToken(expired.state)]);
      assert.equal((await callback(expired, person.code)).headers.get('location'), '/login?authError=failed');
      const wrongProvider = await start(); assert.equal((await callback(wrongProvider, person.code, 'apple')).headers.get('location'), '/login?authError=failed');
      const broken = await start(); const failure = await callback(broken, 'bad-code'); assert.equal(failure.headers.get('location'), '/login?authError=failed&returnTo=%2Fapp');
      assert.equal(await trackCreated(person.subject), undefined);
      assert.equal(failure.headers.getSetCookie().some(value => value.startsWith('seven_session=')), false);
    });
    await t.test('new accounts require a provider verified email', async () => {
      const flow = await start(); const person = identity(undefined, false);
      assert.equal((await callback(flow, person.code)).headers.get('location'), '/login?authError=email_unverified&returnTo=%2Fapp');
      assert.equal(await trackCreated(person.subject), undefined);
    });
    await t.test('email equality cannot take over an existing admin account', async () => {
      const admin = await account('ADMIN'); const flow = await start(); const person = identity(admin.email);
      assert.equal((await callback(flow, person.code)).headers.get('location'), '/login?authError=existing_account&returnTo=%2Fapp');
      assert.equal(await trackCreated(person.subject), undefined);
      assert.equal((await rows(pool, 'SELECT session_id FROM seven.sessions WHERE user_id=$1', [admin.id])).length, 0);
    });
    await t.test('linking requires a session, CSRF, and recent authentication or a correct password', async () => {
      const user = await account(); const signedIn = await login(user); const person = identity(user.email);
      assert.equal((await request('/auth/social/google/start', { intent: 'link' })).response.status, 401);
      assert.equal((await request('/auth/social/google/start', { intent: 'link' }, signedIn.cookie)).response.status, 403);
      await pool.query("UPDATE seven.sessions SET created_at=now()-interval '11 minutes' WHERE user_id=$1", [user.id]);
      assert.equal((await request('/auth/social/google/start', { intent: 'link' }, signedIn.cookie, signedIn.json.data?.csrfToken)).json.error?.code, 'REAUTHENTICATION_REQUIRED');
      assert.equal((await request('/auth/social/google/start', { intent: 'link', currentPassword: 'Incorrect-passphrase-42!' }, signedIn.cookie, signedIn.json.data?.csrfToken)).response.status, 401);
      const flow = await start('google', { intent: 'link', currentPassword: password, returnTo: '/app/profile' }, signedIn.cookie, signedIn.json.data?.csrfToken);
      assert.equal((await callback(flow, person.code)).headers.get('location'), '/app/profile?authSuccess=linked');
      assert.equal(await trackCreated(person.subject), user.id);
      const accounts = await request('/auth/social/accounts', undefined, signedIn.cookie); assert.equal(accounts.json.data?.accounts?.[0]?.provider, 'google');
      const nextFlow = await start(); const nextSignIn = await callback(nextFlow, person.code); assert.equal(nextSignIn.headers.get('location'), '/app');
      assert.equal(await trackCreated(person.subject), user.id);
    });
    await t.test('a revoked linking session cannot attach credentials', async () => {
      const user = await account(); const signedIn = await login(user); const person = identity(user.email);
      const flow = await start('google', { intent: 'link' }, signedIn.cookie, signedIn.json.data?.csrfToken);
      await pool.query('DELETE FROM seven.sessions WHERE user_id=$1', [user.id]);
      assert.equal((await callback(flow, person.code)).headers.get('location'), '/login?authError=failed');
      assert.equal(await trackCreated(person.subject), undefined);
    });
    await t.test('Apple form_post uses the temporary browser cookie without an ordinary session cookie or app Origin', async () => {
      const user = await account(); const signedIn = await login(user); const person = identity(user.email);
      const flow = await start('apple', { intent: 'link', returnTo: '/app/profile' }, signedIn.cookie, signedIn.json.data?.csrfToken);
      const result = await callback(flow, person.code, 'apple'); assert.equal(result.status, 303); assert.equal(result.headers.get('location'), '/app/profile?authSuccess=linked');
      assert.equal(await trackCreated(person.subject), user.id);
    });
    await t.test('a provider identity cannot be linked to a second account', async () => {
      const owner = await account(); const other = await account(); const person = identity(owner.email);
      const firstLogin = await login(owner); const first = await start('google', { intent: 'link' }, firstLogin.cookie, firstLogin.json.data?.csrfToken); assert.equal((await callback(first, person.code)).headers.get('location'), '/app/profile?authSuccess=linked');
      const secondLogin = await login(other); const second = await start('google', { intent: 'link' }, secondLogin.cookie, secondLogin.json.data?.csrfToken); assert.equal((await callback(second, person.code)).headers.get('location'), '/login?authError=already_linked&returnTo=%2Fapp%2Fprofile');
      assert.equal(await trackCreated(person.subject), owner.id);
    });
    await t.test('disabled existing accounts cannot sign in through an already linked provider', async () => {
      const person = identity(); const first = await start(); assert.equal((await callback(first, person.code)).headers.get('location'), '/app'); const userId = await trackCreated(person.subject); assert.ok(userId);
      await pool.query('UPDATE seven.users SET is_active=false WHERE user_id=$1', [userId]);
      const later = await start(); assert.equal((await callback(later, person.code)).headers.get('location'), '/login?authError=unavailable&returnTo=%2Fapp');
    });
    await t.test('provider cancellation preserves the stored checkout destination and ignores callback redirect input', async () => {
      const returnTo = `/checkout/booking?reservationId=${randomUUID()}#payment`;
      const flow = await start('google', { returnTo });
      const query = new URLSearchParams({ state: flow.state, error: 'access_denied', returnTo: 'https://attacker.test' });
      const result = await fetch(`${base}/api/auth/social/google/callback?${query}`, { headers: { Cookie: flow.cookie }, redirect: 'manual' });
      const location = new URL(result.headers.get('location')!, origin);
      assert.equal(location.origin, origin); assert.equal(location.pathname, '/login');
      assert.equal(location.searchParams.get('authError'), 'cancelled'); assert.equal(location.searchParams.get('returnTo'), returnTo);
      assert.equal(result.headers.getSetCookie().some(value => value.startsWith('seven_session=')), false);
      const forged = await fetch(`${base}/api/auth/social/google/callback?${query}`, { headers: { Cookie: flow.cookie }, redirect: 'manual' });
      assert.equal(forged.headers.get('location'), '/login?authError=failed', 'A replay cannot supply or recover a redirect destination.');
    });
    await t.test('the durable social start limit blocks further attempts without creating another flow', async () => {
      await pool.query('UPDATE seven.account_rate_limits SET request_count=60 WHERE scope_hash=$1', [rateScopes[0]]);
      const blocked = await request('/auth/social/google/start', {});
      assert.equal(blocked.response.status, 429); assert.equal(blocked.json.error?.code, 'RATE_LIMITED');
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    // Account/audit fixtures are retained in the isolated test database, like other integration suites.
    // Purge only this suite's expiring OAuth attempts; never touch another account's credentials.
    await pool.query('DELETE FROM seven.social_auth_challenges WHERE nonce=ANY($1::text[])', [[...seenNonces]]);
    await pool.query('DELETE FROM seven.account_rate_limits WHERE scope_hash=ANY($1::text[])', [rateScopes]);
    await pool.end();
  }
});
