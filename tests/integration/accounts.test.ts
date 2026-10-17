import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { createPool, one, rows, ApiError } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { createApp } from '../../services/platform/src/app.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { hashPassword, verifyPassword, digestToken, newToken } from '../../services/platform/src/auth.ts';
import { mountAccountRoutes, rateLimitLogin } from '../../services/platform/src/accounts.ts';
import type { RecoveryMessage } from '../../services/platform/src/accounts.ts';

const origin = 'http://localhost:5177';
const oldPassword = 'Account-original-passphrase-42!';
const newPassword = 'Account-recovered-passphrase-57!';
interface Result { status: number; data?: { message?: string; success?: boolean; user?: { id: string }; csrfToken?: string }; error?: { code: string } }

test('account recovery and password change use real PostgreSQL and session middleware', { skip: !process.env.TEST_DATABASE_URL, timeout: 120000 }, async t => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  assert.match((await one(pool, 'SELECT current_database() AS db'))?.db, /_test_db$/);
  await migrate(pool);
  const delivered: RecoveryMessage[] = [];
  let rejectDelivery = false;
  const runtime = createApp({ pool, provider: new MockProvider(), environment: 'test', publicOrigin: origin, sendRecovery: async (message: RecoveryMessage) => { if (rejectDelivery) throw new Error('Synthetic delivery failure'); delivered.push(message); } });
  const server = await new Promise<Server>(resolve => { const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function request(path: string, body: unknown, cookie = '', csrf = ''): Promise<Result & { cookie: string }> {
    const response = await fetch(`${base}/api${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrf }, body: JSON.stringify(body) });
    return { status: response.status, ...await response.json() as Omit<Result, 'status'>, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
  }
  async function account(label: string): Promise<{ id: string; email: string }> {
    const id = randomUUID(); const email = `${label}-${id}@seven.test`;
    await pool.query("INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id) VALUES($1,$2,$3,$4,(SELECT role_id FROM seven.roles WHERE role_code='CUSTOMER'))", [id, email, 'Synthetic account fixture', await hashPassword(oldPassword)]);
    return { id, email };
  }
  async function link(email: string): Promise<string> {
    const before = delivered.length;
    assert.equal((await request('/auth/recovery', { email })).status, 200);
    for (let attempt = 0; delivered.length === before && attempt < 30; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
    const message = delivered.at(-1)!; assert.equal(message.to, email); assert.ok(Date.parse(message.expiresAt) > Date.now());
    const url = new URL(message.recoveryUrl); assert.equal(url.origin, origin); assert.equal(url.pathname, '/reset-password');
    return url.searchParams.get('token')!;
  }
  try {
    await t.test('existent and unknown emails return the same response without exposing tokens', async () => {
      const user = await account('generic');
      const exists = await request('/auth/recovery', { email: user.email }); const missing = await request('/auth/recovery', { email: `unknown-${randomUUID()}@seven.test` });
      assert.equal(exists.status, 200); assert.deepEqual(exists.data, missing.data); assert.equal(missing.status, 200);
      assert.equal(JSON.stringify(exists).includes('token'), false);
      const record = await one(pool, 'SELECT * FROM seven.account_recoveries WHERE user_id=$1', [user.id]);
      assert.match(record?.token_hash, /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(record).includes(new URL(delivered.at(-1)!.recoveryUrl).searchParams.get('token')!), false);
    });
    await t.test('a walk-in guest claims only their own account and revokes every existing session', async () => {
      const user = await account('walk-in'); const stranger = await account('stranger');
      await pool.query('UPDATE seven.users SET password_hash=$2 WHERE user_id=$1', [user.id, await hashPassword(newToken())]);
      for (let i=0; i<2; i++) await pool.query("INSERT INTO seven.sessions(session_id,user_id,token_hash,csrf_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 day')", [randomUUID(), user.id, digestToken(newToken()), digestToken(newToken())]);
      const token = await link(user.email); assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      assert.equal((await request('/auth/recovery/complete', { token, password: newPassword, userId: stranger.id })).status, 422, 'User identity cannot be supplied with the token');
      const result = await request('/auth/recovery/complete', { token, password: newPassword }); assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.cookie, 'seven_session=', 'Recovery clears stale session cookies and does not sign in');
      assert.equal(await verifyPassword(newPassword, (await one(pool, 'SELECT password_hash FROM seven.users WHERE user_id=$1', [user.id]))!.password_hash), true);
      assert.equal(await verifyPassword(oldPassword, (await one(pool, 'SELECT password_hash FROM seven.users WHERE user_id=$1', [stranger.id]))!.password_hash), true);
      assert.equal((await rows(pool, 'SELECT session_id FROM seven.sessions WHERE user_id=$1', [user.id])).length, 0);
      assert.equal((await request('/auth/login', { email: user.email, password: newPassword })).status, 200, 'Email owner can access the existing walk-in account');
      assert.equal((await request('/auth/recovery/complete', { token, password: oldPassword })).status, 400, 'A consumed token cannot be replayed');
      const events = await rows(pool, "SELECT * FROM seven.audit_events WHERE action_code='account.password_recovered' AND resource_id=$1", [user.id]);
      assert.equal(events.length, 1); assert.equal(events[0]?.user_id, user.id); assert.equal(JSON.stringify(events).includes(token), false); assert.equal(JSON.stringify(events).includes(newPassword), false);
    });
    await t.test('expired, revoked, malformed and weak-password resets leave the password unchanged', async () => {
      const user = await account('expired'); const expired = await link(user.email);
      await pool.query("UPDATE seven.account_recoveries SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [digestToken(expired)]);
      assert.equal((await request('/auth/recovery/complete', { token: expired, password: newPassword })).status, 400);
      const revoked = await link(user.email); const current = await link(user.email);
      assert.equal((await request('/auth/recovery/complete', { token: revoked, password: newPassword })).status, 400);
      assert.equal((await request('/auth/recovery/complete', { token: current, password: 'too-short' })).status, 422);
      assert.equal((await request('/auth/recovery/complete', { token: current, password: 'x'.repeat(129) })).status, 422);
      assert.equal((await request('/auth/recovery/complete', { token: 'malformed', password: newPassword })).status, 422);
      assert.equal(await verifyPassword(oldPassword, (await one(pool, 'SELECT password_hash FROM seven.users WHERE user_id=$1', [user.id]))!.password_hash), true);
    });
    await t.test('concurrent completion consumes a token once and persists no competing password', async () => {
      const user = await account('race'); const token = await link(user.email);
      const attempts = await Promise.all(Array.from({length: 10}, () => request('/auth/recovery/complete', { token, password: newPassword })));
      assert.equal(attempts.filter(result => result.status === 200).length, 1); assert.equal(attempts.filter(result => result.status === 400).length, 9);
      assert.equal((await rows(pool, "SELECT audit_event_id FROM seven.audit_events WHERE action_code='account.password_recovered' AND resource_id=$1", [user.id])).length, 1);
    });
    await t.test('password change verifies current secret, requires CSRF and revokes all sessions and links', async () => {
      const user = await account('change'); const outstanding = await link(user.email);
      const login = await request('/auth/login', { email: user.email, password: oldPassword }); const second = await request('/auth/login', { email: user.email, password: oldPassword });
      assert.equal((await request('/me/password', { currentPassword: oldPassword, newPassword }, login.cookie)).status, 403);
      assert.equal((await request('/me/password', { currentPassword: 'Wrong-password-12', newPassword }, login.cookie, login.data?.csrfToken)).status, 401);
      assert.equal((await request('/me/password', { currentPassword: oldPassword, newPassword: 'short' }, login.cookie, login.data?.csrfToken)).status, 422);
      assert.equal((await request('/me/password', { currentPassword: oldPassword, newPassword }, login.cookie, login.data?.csrfToken)).status, 200);
      assert.equal((await request('/me/password', { currentPassword: newPassword, newPassword: oldPassword }, second.cookie, second.data?.csrfToken)).status, 401);
      assert.equal((await request('/auth/recovery/complete', { token: outstanding, password: oldPassword })).status, 400);
      assert.equal((await request('/auth/login', { email: user.email, password: oldPassword })).status, 401); assert.equal((await request('/auth/login', { email: user.email, password: newPassword })).status, 200);
    });
    await t.test('request limits persist in the database and count unknown accounts identically', async () => {
      await pool.query('TRUNCATE seven.account_rate_limits');
      const email = `missing-limit-${randomUUID()}@seven.test`;
      for(let i=0; i<5; i++) assert.equal((await request('/auth/recovery', {email})).status, 200);
      assert.equal((await request('/auth/recovery', {email})).status, 429);
      assert.ok((await rows(pool, 'SELECT request_count FROM seven.account_rate_limits')).some(row => row.request_count === 6));
    });
    await t.test('failed delivery is audited and its token revoked without changing the generic response', async () => {
      const user = await account('failed-delivery'); rejectDelivery = true;
      try {
        const response = await request('/auth/recovery', {email:user.email}); assert.equal(response.status,200); assert.equal(response.data?.message, 'If this email has a 7even account, a password reset link will be sent.');
        let recovery = await one(pool, 'SELECT * FROM seven.account_recoveries WHERE user_id=$1', [user.id]);
        for(let attempt=0;!recovery?.delivery_failed_at&&attempt<30;attempt++) { await new Promise(resolve=>setTimeout(resolve,10)); recovery=await one(pool,'SELECT * FROM seven.account_recoveries WHERE user_id=$1',[user.id]); }
        assert.ok(recovery?.delivery_failed_at); assert.ok(recovery?.revoked_at);
        assert.equal((await rows(pool,"SELECT audit_event_id FROM seven.audit_events WHERE action_code='account.recovery_delivery_failed' AND resource_id=$1",[user.id])).length,1);
      } finally { rejectDelivery = false; }
    });
    await t.test('login limits bind account and IP independently across concurrent callers', async () => {
      const email = `${randomUUID()}@seven.test`; const ip = `synthetic-${randomUUID()}`;
      const results = await Promise.allSettled(Array.from({length:20}, () => rateLimitLogin(pool,ip,email)));
      assert.equal(results.filter(result=>result.status==='fulfilled').length,15); assert.equal(results.filter(result=>result.status==='rejected').length,5);
      await assert.rejects(rateLimitLogin(pool,`different-${randomUUID()}`,email), (error:unknown)=>error instanceof ApiError&&error.status===429, 'Changing IP does not bypass the account counter');
      const emailCounter = await one(pool,'SELECT request_count FROM seven.account_rate_limits WHERE scope_hash=$1',[digestToken(`login:email:${email}`)]); assert.equal(emailCounter?.request_count,21);
      const blockedIp=`synthetic-${randomUUID()}`;
      for(let i=0;i<60;i++) await rateLimitLogin(pool,blockedIp,`${randomUUID()}@seven.test`);
      await assert.rejects(rateLimitLogin(pool,blockedIp,`${randomUUID()}@seven.test`),(error:unknown)=>error instanceof ApiError&&error.status===429, 'Changing account does not bypass the IP counter');
    });
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await pool.end(); }
});

test('production recovery is uniformly unavailable without an injected delivery adapter', async () => {
  const pool = createPool('postgresql://unused:unused@127.0.0.1:1/unused_test_db');
  const app = express(); app.use(express.json()); mountAccountRoutes(app, { pool, environment: 'production', publicOrigin: 'https://seven.example.test' });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => { const status = error instanceof ApiError ? error.status : error instanceof z.ZodError ? 422 : 500; res.status(status).json({ error: { code: error instanceof ApiError ? error.code : 'ERROR' } }); });
  const server = await new Promise<Server>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for(const email of ['guest@seven.test','unknown@example.test']) { const response = await fetch(`${base}/api/auth/recovery`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}); assert.equal(response.status,503); assert.deepEqual(await response.json(),{error:{code:'RECOVERY_UNAVAILABLE'}}); }
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await pool.end(); }
});
