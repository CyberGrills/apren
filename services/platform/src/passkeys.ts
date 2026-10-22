import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool, QueryResultRow } from 'pg';
import type { SessionData, SessionUser } from '@7even/contracts';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { decodeClientDataJSON } from '@simplewebauthn/server/helpers';
import { z } from 'zod';
import { digestToken, newToken, verifyPassword } from './auth.ts';
import { rateLimitLogin } from './accounts.ts';
import { fail, one, rows, transaction } from './db.ts';
import type { Connection } from './db.ts';
import { audit, userProjection } from './store.ts';

interface PasskeyOptions {
  pool: Pool;
  environment: string;
  publicOrigin: string;
  issueSession: (db: Connection, res: Response, userId: string) => Promise<SessionData>;
}
type Purpose = 'registration' | 'authentication';
const emptyInput = z.object({}).strict();
const registrationInput = z.object({ response: z.record(z.string(), z.unknown()), name: z.string().trim().min(1).max(80) }).strict();
const authenticationInput = z.object({ response: z.record(z.string(), z.unknown()) }).strict();
const deletionInput = z.object({ currentPassword: z.string().min(1).max(128).optional() }).strict();
const base64url = /^[A-Za-z0-9_-]+$/;
const supportedAlgorithmIDs = [-7, -257, -8];
function invalid(): never { return fail(400, 'PASSKEY_INVALID', 'This passkey could not be verified. Please try signing in again.'); }
const projection = (row: QueryResultRow) => ({ id: row.passkey_id as string, name: row.passkey_name as string, createdAt: new Date(row.created_at).toISOString(), lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null });
function requireTopLevelResponse(response: Record<string, unknown>): void {
  const data = response.response as Record<string, unknown> | undefined;
  if (typeof data?.clientDataJSON !== 'string') invalid();
  const clientData = decodeClientDataJSON(data.clientDataJSON);
  if (clientData.crossOrigin || clientData.topOrigin) invalid();
}

export function passkeysEnabled(publicOrigin: string): boolean {
  try {
    const origin = new URL(publicOrigin);
    const hostname = origin.hostname.replace(/^\[|\]$/g, '');
    return origin.origin === publicOrigin && !isIP(hostname) && (origin.protocol === 'https:' || (origin.protocol === 'http:' && hostname === 'localhost'));
  } catch { return false; }
}

export function mountPasskeyRoutes(app: Express, options: PasskeyOptions): void {
  const { pool, environment, publicOrigin, issueSession } = options;
  const origin = new URL(publicOrigin);
  if (origin.origin !== publicOrigin || (environment === 'production' && origin.protocol !== 'https:')) throw new Error('Passkeys require a canonical origin and HTTPS in production.');
  const cookieOptions = { httpOnly: true, secure: origin.protocol === 'https:', sameSite: 'strict' as const, path: '/api/auth/passkeys', maxAge: 5 * 60 * 1000 };
  const cookieName = (purpose: Purpose) => `seven_passkey_${purpose}`;
  const binding = (req: Request, purpose: Purpose) => req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName(purpose)}=`))?.slice(cookieName(purpose).length + 1);
  const actorFor = (res: Response): SessionUser => (res.locals.actor as SessionUser | undefined) ?? fail(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
  const recentActor = (res: Response): SessionUser => {
    const actor = actorFor(res);
    const createdAt = new Date(res.locals.session?.created_at ?? 0).getTime();
    if (!Number.isFinite(createdAt) || createdAt < Date.now() - 10 * 60 * 1000) return fail(401, 'REAUTHENTICATION_REQUIRED', 'Sign in again before changing your passkeys.');
    return actor;
  };
  const route = (method: 'get' | 'post' | 'delete', path: string, work: (req: Request, res: Response) => Promise<unknown>): void => {
    app[method](`/api/auth/passkeys${path}`, async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!passkeysEnabled(publicOrigin)) return fail(503, 'PASSKEY_UNAVAILABLE', 'Open 7even using its secure website address to use a passkey. For local development, use localhost instead of an IP address.');
        if (method !== 'get' && req.get('Origin') !== publicOrigin) return fail(403, 'ORIGIN_REJECTED', 'Open the main 7even website to use a passkey.');
        res.json({ data: await work(req, res) });
      } catch (error) { next(error); }
    });
  };
  async function saveChallenge(req: Request, res: Response, purpose: Purpose, challenge: string, userId?: string): Promise<void> {
    const token = newToken();
    await transaction(pool, async db => {
      await db.query('DELETE FROM seven.passkey_challenges WHERE expires_at<clock_timestamp() OR binding_hash=$1', [digestToken(binding(req, purpose) ?? '')]);
      await db.query("DELETE FROM seven.account_rate_limits WHERE window_started_at<now()-interval '1 day'");
      await db.query("INSERT INTO seven.passkey_challenges(passkey_challenge_id,user_id,binding_hash,challenge_hash,purpose_code,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes')", [randomUUID(), userId ?? null, digestToken(token), digestToken(challenge), purpose]);
    });
    res.cookie(cookieName(purpose), token, cookieOptions);
  }
  async function consumeChallenge(req: Request, res: Response, purpose: Purpose, userId?: string): Promise<QueryResultRow> {
    const token = binding(req, purpose);
    res.clearCookie(cookieName(purpose), cookieOptions);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return invalid();
    // Consumption commits before proof verification, so failed attempts cannot replay a challenge.
    const challenge = await one(pool, 'DELETE FROM seven.passkey_challenges WHERE binding_hash=$1 AND purpose_code=$2 RETURNING *', [digestToken(token), purpose]);
    if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now() || (challenge.user_id ?? undefined) !== userId) return invalid();
    return challenge;
  }
  async function activeUser(db: Connection, userId: string): Promise<QueryResultRow> {
    return (await one(db, 'SELECT user_id,email,display_name,password_hash FROM seven.users WHERE user_id=$1 AND is_active FOR UPDATE', [userId])) ?? fail(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
  }
  async function requireManagementSession(db: Connection, res: Response, userId: string): Promise<void> {
    // The caller holds the user lock, matching password reset's user -> session lock order.
    const session = await one(db, "SELECT session_id FROM seven.sessions WHERE session_id=$1 AND user_id=$2 AND expires_at>clock_timestamp() AND created_at>clock_timestamp()-interval '10 minutes' FOR UPDATE", [res.locals.session?.session_id ?? null, userId]);
    if (!session) fail(401, 'REAUTHENTICATION_REQUIRED', 'Sign in again before changing your passkeys.');
  }

  route('post', '/authentication/options', async (req, res) => {
    emptyInput.parse(req.body);
    await rateLimitLogin(pool, req.ip ?? 'unknown', `passkey-options:${req.ip ?? 'unknown'}`);
    const challenge = await generateAuthenticationOptions({ rpID: origin.hostname, timeout: 300000, userVerification: 'required' });
    await saveChallenge(req, res, 'authentication', challenge.challenge);
    return challenge;
  });
  route('post', '/authentication/verify', async (req, res) => {
    const { response } = authenticationInput.parse(req.body);
    const challenge = await consumeChallenge(req, res, 'authentication');
    const credentialId = z.string().min(1).max(1400).regex(base64url).parse(response.id);
    await rateLimitLogin(pool, req.ip ?? 'unknown', `passkey:${digestToken(credentialId)}`);
    const owner = await one(pool, 'SELECT user_id FROM seven.passkeys WHERE credential_id=$1', [credentialId]);
    if (!owner || typeof response.response !== 'object' || response.response === null) return invalid();
    const handle = (response.response as Record<string, unknown>).userHandle;
    if (typeof handle !== 'string' || handle !== Buffer.from(owner.user_id).toString('base64url')) return invalid();
    return transaction(pool, async db => {
      await activeUser(db, owner.user_id);
      const credential = await one(db, 'SELECT * FROM seven.passkeys WHERE credential_id=$1 AND user_id=$2 FOR UPDATE', [credentialId, owner.user_id]);
      if (!credential) return invalid();
      let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
      try {
        requireTopLevelResponse(response);
        verification = await verifyAuthenticationResponse({ response: response as unknown as AuthenticationResponseJSON, expectedChallenge: value => digestToken(value) === challenge.challenge_hash, expectedOrigin: publicOrigin, expectedRPID: origin.hostname, requireUserVerification: true, credential: { id: credential.credential_id, publicKey: new Uint8Array(credential.public_key), counter: Number(credential.signature_counter), transports: credential.transports } });
      } catch { return invalid(); }
      if (!verification.verified) return invalid();
      await db.query('UPDATE seven.passkeys SET signature_counter=$2,device_type=$3,backed_up=$4,last_used_at=now(),updated_at=now() WHERE passkey_id=$1', [credential.passkey_id, verification.authenticationInfo.newCounter, verification.authenticationInfo.credentialDeviceType, verification.authenticationInfo.credentialBackedUp]);
      await audit(db, await userProjection(db, owner.user_id), null, 'account.passkey_signed_in', credential.passkey_id);
      return issueSession(db, res, owner.user_id);
    });
  });
  route('post', '/registration/options', async (req, res) => {
    emptyInput.parse(req.body); const actor = recentActor(res);
    await rateLimitLogin(pool, req.ip ?? 'unknown', `passkey-registration:${actor.id}`);
    const user = await activeUser(pool, actor.id);
    const credentials = await rows(pool, 'SELECT credential_id,transports FROM seven.passkeys WHERE user_id=$1', [actor.id]);
    if (credentials.length >= 20) return fail(409, 'PASSKEY_LIMIT', 'You can save up to 20 passkeys. Remove one before adding another.');
    const challenge = await generateRegistrationOptions({ rpName: '7even', rpID: origin.hostname, userID: new Uint8Array(Buffer.from(actor.id)), userName: user.email, userDisplayName: user.display_name, timeout: 300000, attestationType: 'none', supportedAlgorithmIDs, authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, excludeCredentials: credentials.map(row => ({ id: row.credential_id, transports: row.transports })) });
    await saveChallenge(req, res, 'registration', challenge.challenge, actor.id);
    return challenge;
  });
  route('post', '/registration/verify', async (req, res) => {
    const actor = recentActor(res); const input = registrationInput.parse(req.body);
    const challenge = await consumeChallenge(req, res, 'registration', actor.id);
    await rateLimitLogin(pool, req.ip ?? 'unknown', `passkey-registration:${actor.id}`);
    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      requireTopLevelResponse(input.response);
      verification = await verifyRegistrationResponse({ response: input.response as unknown as RegistrationResponseJSON, expectedChallenge: value => digestToken(value) === challenge.challenge_hash, expectedOrigin: publicOrigin, expectedRPID: origin.hostname, requireUserVerification: true, supportedAlgorithmIDs });
    } catch { return invalid(); }
    if (!verification.verified) return invalid();
    const info = verification.registrationInfo;
    const credentialId = z.string().min(1).max(1400).regex(base64url).parse(info.credential.id);
    const transports = z.array(z.string().max(32)).max(16).parse(info.credential.transports ?? []);
    if (info.credential.publicKey.length < 32 || info.credential.publicKey.length > 4096) return invalid();
    return transaction(pool, async db => {
      await activeUser(db, actor.id);
      await requireManagementSession(db, res, actor.id);
      if ((await rows(db, 'SELECT passkey_id FROM seven.passkeys WHERE user_id=$1', [actor.id])).length >= 20) return fail(409, 'PASSKEY_LIMIT', 'You can save up to 20 passkeys. Remove one before adding another.');
      const credential = await one(db, 'INSERT INTO seven.passkeys(passkey_id,user_id,credential_id,public_key,signature_counter,passkey_name,transports,device_type,backed_up) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(credential_id) DO NOTHING RETURNING *', [randomUUID(), actor.id, credentialId, Buffer.from(info.credential.publicKey), info.credential.counter, input.name, transports, info.credentialDeviceType, info.credentialBackedUp]);
      if (!credential) return fail(409, 'PASSKEY_EXISTS', 'This passkey is already registered.');
      await audit(db, actor, null, 'account.passkey_added', credential.passkey_id);
      return projection(credential);
    });
  });
  route('get', '', async (_req, res) => {
    const actor = actorFor(res);
    return { passkeys: (await rows(pool, 'SELECT passkey_id,passkey_name,created_at,last_used_at FROM seven.passkeys WHERE user_id=$1 ORDER BY created_at', [actor.id])).map(projection) };
  });
  route('delete', '/:id', async (req, res) => {
    const actor = recentActor(res); const passkeyId = z.uuid().parse(req.params.id); const input = deletionInput.parse(req.body ?? {});
    await rateLimitLogin(pool, req.ip ?? 'unknown', `passkey-removal:${actor.id}`);
    return transaction(pool, async db => {
      const user = await activeUser(db, actor.id);
      await requireManagementSession(db, res, actor.id);
      const passkeys = await rows(db, 'SELECT passkey_id FROM seven.passkeys WHERE user_id=$1 FOR UPDATE', [actor.id]);
      if (!passkeys.some(key => key.passkey_id === passkeyId)) return fail(404, 'NOT_FOUND', 'This passkey could not be found.');
      const social = await one(db, 'SELECT identity_id FROM seven.social_auth_identities WHERE user_id=$1 LIMIT 1', [actor.id]);
      if (passkeys.length === 1 && !social && (!input.currentPassword || !await verifyPassword(input.currentPassword, user.password_hash))) return fail(409, 'LAST_LOGIN_METHOD', 'Enter your current password or add another sign-in method before removing your last passkey.');
      await db.query('DELETE FROM seven.passkeys WHERE passkey_id=$1 AND user_id=$2', [passkeyId, actor.id]);
      await audit(db, actor, null, 'account.passkey_removed', passkeyId);
      return { success: true };
    });
  });
}
