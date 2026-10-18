import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import type { SessionUser } from '@7even/contracts';
import { z } from 'zod';
import { hashPassword, verifyPassword, digestToken, newToken } from './auth.ts';
import { fail, one, transaction } from './db.ts';
import type { Connection } from './db.ts';
import { audit, notify, userProjection } from './store.ts';

export interface RecoveryMessage { to: string; recoveryUrl: string; expiresAt: string }
/** The configured adapter must keep the URL private and deliver it to this address only. */
export interface RecoveryMailer { sendRecovery(message: RecoveryMessage): Promise<void> }
export interface AccountOptions { pool: Pool; environment: string; publicOrigin: string; sendRecovery?: RecoveryMailer['sendRecovery'] }

const emailInput = z.object({ email: z.string().trim().toLowerCase().max(320).email() }).strict();
const password = z.string().min(12).max(128);
const completionInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password }).strict();
const changeInput = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).strict();
const genericMessage = 'If this email has a 7even account, a password reset link will be sent.';
const mailboxPath = new URL('../../../.local/recovery-mailbox.json', import.meta.url);
let mailboxTail: Promise<void> = Promise.resolve();

/** Development fixture only. No real recipient is written and no API serves this file. */
async function localMailbox(message: RecoveryMessage): Promise<void> {
  if (!message.to.endsWith('.test')) return;
  const write = mailboxTail.then(async () => {
    await mkdir(new URL('.', mailboxPath), { recursive: true, mode: 0o700 });
    let previous: (RecoveryMessage & { sentAt: string })[] = [];
    try { previous = JSON.parse(await readFile(mailboxPath, 'utf8')) as typeof previous; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const entries = [...previous.filter(entry => Date.parse(entry.expiresAt) > Date.now()), { ...message, sentAt: new Date().toISOString() }].slice(-50);
    const temporary = new URL(`recovery-mailbox-${randomUUID()}.tmp`, mailboxPath);
    await writeFile(temporary, JSON.stringify(entries, null, 2), { mode: 0o600 });
    await rename(temporary, mailboxPath); await chmod(mailboxPath, 0o600);
  });
  mailboxTail = write.catch(() => {});
  return write;
}

async function limit(pool: Pool, scope: string, maximum: number): Promise<void> {
  const result = await one(pool, `INSERT INTO seven.account_rate_limits(account_rate_limit_id,scope_hash,window_started_at)
    VALUES($1,$2,date_bin(interval '15 minutes',now(),timestamptz '2000-01-01 00:00:00+00'))
    ON CONFLICT(scope_hash,window_started_at) DO UPDATE SET request_count=LEAST(seven.account_rate_limits.request_count+1,1000000),updated_at=now()
    RETURNING request_count`, [randomUUID(), digestToken(scope)]);
  if (result!.request_count > maximum) fail(429, 'RATE_LIMITED', 'Too many attempts. Try again in 15 minutes.');
}

/** Shared-worker sign-in and registration throttling; callers validate credential payloads. */
export async function rateLimitLogin(pool: Pool, ip: string, email: string): Promise<void> {
  await limit(pool, `login:ip:${ip}`, 60);
  await limit(pool, `login:email:${email.trim().toLowerCase()}`, 15);
}

async function revokeCredentials(db: Connection, userId: string, passwordHash: string, recoveryId?: string): Promise<void> {
  // Caller holds the user row lock. Keep user -> recovery -> session ordering everywhere.
  await db.query('UPDATE seven.users SET password_hash=$2,updated_at=now() WHERE user_id=$1', [userId, passwordHash]);
  await db.query('UPDATE seven.account_recoveries SET revoked_at=now(),updated_at=now() WHERE user_id=$1 AND used_at IS NULL AND revoked_at IS NULL AND ($2::uuid IS NULL OR account_recovery_id<>$2)', [userId, recoveryId ?? null]);
  await db.query('DELETE FROM seven.sessions WHERE user_id=$1', [userId]);
}

export function mountAccountRoutes(app: Express, options: AccountOptions): void {
  const { pool, environment, publicOrigin } = options;
  const origin = new URL(publicOrigin);
  if (origin.origin !== publicOrigin || (environment === 'production' && origin.protocol !== 'https:')) throw new Error('Account recovery requires a canonical configured origin and HTTPS in production.');
  const send = options.sendRecovery ?? (environment === 'development' || environment === 'test' ? localMailbox : undefined);
  const clearCookie = (res: Response): void => { res.clearCookie('seven_session', { path: '/', httpOnly: true, secure: environment === 'production', sameSite: 'lax' }); };
  const route = (path: string, work: (req: Request, res: Response) => Promise<unknown>): void => {
    app.post(`/api${path}`, async (req, res, next: NextFunction) => { try { res.json({ data: await work(req, res) }); } catch (error) { next(error); } });
  };
  const actorFor = (res: Response): SessionUser => (res.locals.actor as SessionUser | undefined) ?? fail(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');

  route('/auth/recovery', async req => {
    const started = performance.now();
    try {
      const { email } = emailInput.parse(req.body);
      if (!send) return fail(503, 'RECOVERY_UNAVAILABLE', 'Password recovery is temporarily unavailable. Please try again later.');
      await limit(pool, `request:ip:${req.ip}`, 30); await limit(pool, `request:email:${email}`, 5);
      const token = newToken();
      const message = await transaction(pool, async db => {
        const user = await one(db, 'SELECT user_id FROM seven.users WHERE email=$1 AND is_active FOR UPDATE', [email]);
        if (!user) return null;
        await db.query('UPDATE seven.account_recoveries SET revoked_at=now(),updated_at=now() WHERE user_id=$1 AND used_at IS NULL AND revoked_at IS NULL', [user.user_id]);
        const recovery = await one(db, "INSERT INTO seven.account_recoveries(account_recovery_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '15 minutes') RETURNING expires_at", [randomUUID(), user.user_id, digestToken(token)]);
        await audit(db, null, null, 'account.recovery_requested', user.user_id);
        return { to: email, recoveryUrl: `${publicOrigin}/reset-password?token=${token}`, expiresAt: new Date(recovery!.expires_at).toISOString() };
      });
      if (message) {
        // Delivery never changes the public response or discloses whether the account exists.
        // A crash before delivery is safely recovered by requesting a fresh, superseding link.
        void Promise.resolve().then(() => send(message)).catch(async () => {
          await transaction(pool, async db => {
            const recovery = await one(db, 'UPDATE seven.account_recoveries SET revoked_at=coalesce(revoked_at,now()),delivery_failed_at=now(),updated_at=now() WHERE token_hash=$1 RETURNING user_id', [digestToken(token)]);
            if (recovery) await audit(db, null, null, 'account.recovery_delivery_failed', recovery.user_id);
          });
        }).catch(() => { /* A failed database cannot record delivery failure; no secret is logged. */ });
      }
      await pool.query("DELETE FROM seven.account_rate_limits WHERE window_started_at<now()-interval '1 day'");
      await pool.query("DELETE FROM seven.account_recoveries WHERE expires_at<now()-interval '7 days'");
      return { message: genericMessage };
    } finally {
      // Equal minimum duration and asynchronous delivery reduce existence-related timing signals.
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 300 - (performance.now() - started))));
    }
  });

  route('/auth/recovery/complete', async (req, res) => {
    const input = completionInput.parse(req.body); await limit(pool, `complete:ip:${req.ip}`, 30);
    const tokenHash = digestToken(input.token);
    const identity = await one(pool, 'SELECT user_id FROM seven.account_recoveries WHERE token_hash=$1', [tokenHash]);
    if (!identity) return fail(400, 'RECOVERY_INVALID', 'This reset link has expired or has already been used. Request a new one.');
    const passwordHash = await hashPassword(input.password);
    await transaction(pool, async db => {
      const user = await one(db, 'SELECT user_id FROM seven.users WHERE user_id=$1 AND is_active FOR UPDATE', [identity.user_id]);
      const recovery = await one(db, 'SELECT account_recovery_id FROM seven.account_recoveries WHERE token_hash=$1 AND user_id=$2 AND expires_at>clock_timestamp() AND used_at IS NULL AND revoked_at IS NULL FOR UPDATE', [tokenHash, identity.user_id]);
      if (!user || !recovery) return fail(400, 'RECOVERY_INVALID', 'This reset link has expired or has already been used. Request a new one.');
      await db.query('UPDATE seven.account_recoveries SET used_at=now(),updated_at=now() WHERE account_recovery_id=$1', [recovery.account_recovery_id]);
      await revokeCredentials(db, user.user_id, passwordHash, recovery.account_recovery_id);
      await audit(db, await userProjection(db, user.user_id), null, 'account.password_recovered', user.user_id);
      await notify(db, user.user_id, 'Your password was reset', 'All previous sessions have been signed out. If you did not reset it, request a new reset link now.');
    });
    clearCookie(res); return { success: true };
  });

  route('/me/password', async (req, res) => {
    const actor = actorFor(res); const input = changeInput.parse(req.body);
    await limit(pool, `change:user:${actor.id}`, 5); await limit(pool, `change:ip:${req.ip}`, 20);
    await transaction(pool, async db => {
      const user = await one(db, 'SELECT password_hash FROM seven.users WHERE user_id=$1 AND is_active FOR UPDATE', [actor.id]);
      if (!user || !await verifyPassword(input.currentPassword, user.password_hash)) return fail(401, 'INVALID_CREDENTIALS', 'The current password is incorrect.');
      await revokeCredentials(db, actor.id, await hashPassword(input.newPassword));
      await audit(db, actor, null, 'account.password_changed', actor.id);
      await notify(db, actor.id, 'Your password was changed', 'All previous sessions have been signed out. Sign in again with your new password.');
    });
    clearCookie(res); return { success: true };
  });
}
