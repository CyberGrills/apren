import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import type { SessionData, SessionUser } from '@7even/contracts';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { digestToken, newToken, verifyPassword } from './auth.ts';
import { ApiError, fail, one, rows, transaction } from './db.ts';
import type { Connection } from './db.ts';
import { audit, userProjection } from './store.ts';

export type SocialProviderId = 'google' | 'apple';
export interface SocialProviderRequest {
  redirectUri: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}
export interface SocialIdentity {
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}
/** Injection boundary for isolated provider tests. Production uses only the configured OIDC adapter. */
export interface SocialProvider {
  authorizationUrl(input: SocialProviderRequest): string | Promise<string>;
  exchangeAndVerify(input: Omit<SocialProviderRequest, 'state'> & { code: string }): Promise<SocialIdentity>;
}
export interface SocialAuthOptions {
  pool: Pool;
  environment: string;
  publicOrigin: string;
  providers?: Partial<Record<SocialProviderId, SocialProvider>>;
  issueSession(db: Connection, res: Response, userId: string): Promise<SessionData>;
}

const providerInput = z.enum(['google', 'apple']);
const startInput = z.object({
  returnTo: z.string().max(1000).optional(),
  intent: z.enum(['login', 'link']).default('login'),
  currentPassword: z.string().min(1).max(128).optional(),
}).strict();
const callbackInput = z.object({
  state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code: z.string().min(1).max(4096).optional(),
  error: z.string().max(100).optional(),
}).passthrough();
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const emailInput = z.string().trim().toLowerCase().max(320).email();

function canonicalOrigin(publicOrigin: string): URL {
  const origin = new URL(publicOrigin);
  if (origin.origin !== publicOrigin) throw new Error('Social sign-in requires a canonical APP_ORIGIN.');
  return origin;
}

/** Return URLs are local paths only, never provider/user-controlled origins. */
export function safeSocialReturnPath(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string' || value.length > 1000 || !value.startsWith('/') || value.startsWith('//') || (value.includes('\\') || Array.from(value).some(character => character.charCodeAt(0) <= 32))) return fallback;
  const parsed = new URL(value, 'https://seven.invalid');
  if (parsed.origin !== 'https://seven.invalid' || /^\/(?:login|register|api)(?:\/|$)/.test(parsed.pathname)) return fallback;
  return parsed.pathname + parsed.search + parsed.hash;
}

export function socialAuthAvailability(publicOrigin: string): Record<SocialProviderId, boolean> {
  const origin = canonicalOrigin(publicOrigin);
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(origin.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname) && process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
  };
}

async function configuredProvider(provider: SocialProviderId, publicOrigin: string): Promise<SocialProvider | undefined> {
  if (!socialAuthAvailability(publicOrigin)[provider]) return undefined;
  const clientId = (provider === 'google' ? process.env.GOOGLE_CLIENT_ID : process.env.APPLE_CLIENT_ID)!;
  const google = provider === 'google';
  return {
    authorizationUrl(input) {
      const url = new URL(google ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://appleid.apple.com/auth/authorize');
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: input.redirectUri, response_type: 'code', scope: google ? 'openid email profile' : 'name email', state: input.state, nonce: input.nonce }).toString();
      if (google) {
        url.searchParams.set('code_challenge', createHash('sha256').update(input.codeVerifier).digest('base64url'));
        url.searchParams.set('code_challenge_method', 'S256');
      } else url.searchParams.set('response_mode', 'form_post');
      return url.toString();
    },
    async exchangeAndVerify(input) {
      let clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      if (!google) {
        const key = await importPKCS8(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
        clientSecret = await new SignJWT({})
          .setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_KEY_ID! })
          .setIssuer(process.env.APPLE_TEAM_ID!).setSubject(clientId)
          .setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('5m').sign(key);
      }
      const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: input.code, grant_type: 'authorization_code', redirect_uri: input.redirectUri });
      if (google) body.set('code_verifier', input.codeVerifier);
      const response = await fetch(google ? 'https://oauth2.googleapis.com/token' : 'https://appleid.apple.com/auth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return fail(401, 'SOCIAL_PROVIDER_REJECTED', 'The sign-in provider could not verify this request.');
      const tokens = z.object({ id_token: z.string().min(1).max(16000) }).parse(await response.json());
      return verifySocialIdentityToken(tokens.id_token, provider, clientId, input.nonce);
    },
  };
}

/** The same claim verifier is exercised with local signed JWTs; production keys remain provider-pinned. */
export async function verifySocialIdentityToken(token: string, provider: SocialProviderId, clientId: string, nonce: string, keys: JWTVerifyGetKey = provider === 'google' ? googleKeys : appleKeys): Promise<SocialIdentity> {
  const google = provider === 'google';
  const { payload } = await jwtVerify(token, keys, {
    issuer: google ? ['https://accounts.google.com', 'accounts.google.com'] : 'https://appleid.apple.com',
    audience: clientId, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'nonce'], maxTokenAge: '10m',
  });
  if (payload.nonce !== nonce || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255) return fail(401, 'SOCIAL_PROVIDER_REJECTED', 'The sign-in provider could not verify this request.');
  if (google && ((payload.azp !== undefined && payload.azp !== clientId) || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId))) return fail(401, 'SOCIAL_PROVIDER_REJECTED', 'The sign-in provider could not verify this request.');
  const email = emailInput.safeParse(payload.email);
  return { subject: payload.sub, email: email.success ? email.data : undefined, emailVerified: payload.email_verified === true || payload.email_verified === 'true', displayName: typeof payload.name === 'string' ? payload.name.trim().slice(0, 160) : undefined };
}

const cookieName = (state: string): string => `seven_oauth_${state.slice(0, 12)}`;
function cookieValue(req: Request, name: string): string | undefined {
  return req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function rateLimitSocial(pool: Pool, action: 'start' | 'callback', ip: string): Promise<void> {
  if (action === 'start') await pool.query("DELETE FROM seven.account_rate_limits WHERE window_started_at<now()-interval '1 day'");
  const counter = await one(pool, `INSERT INTO seven.account_rate_limits(account_rate_limit_id,scope_hash,window_started_at)
    VALUES($1,$2,date_bin(interval '15 minutes',now(),timestamptz '2000-01-01 00:00:00+00'))
    ON CONFLICT(scope_hash,window_started_at) DO UPDATE SET request_count=LEAST(seven.account_rate_limits.request_count+1,1000000),updated_at=now()
    RETURNING request_count`, [randomUUID(), digestToken(`social:${action}:ip:${ip}`)]);
  if (counter!.request_count > (action === 'start' ? 60 : 120)) return fail(429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again in 15 minutes.');
}

export function mountSocialAuth(app: Express, options: SocialAuthOptions): void {
  const { pool, publicOrigin, environment } = options;
  const origin = canonicalOrigin(publicOrigin);
  if (environment === 'production' && origin.protocol !== 'https:') throw new Error('Social sign-in requires HTTPS in production.');
  const callbackUri = (provider: SocialProviderId): string => `${publicOrigin}/api/auth/social/${provider}/callback`;
  const cookieOptions = { httpOnly: true, secure: origin.protocol === 'https:', sameSite: origin.protocol === 'https:' ? 'none' as const : 'lax' as const, path: '/api/auth/social', maxAge: 10 * 60 * 1000 };
  const adapterFor = async (provider: SocialProviderId): Promise<SocialProvider> => options.providers?.[provider] ?? await configuredProvider(provider, publicOrigin) ?? fail(503, 'SOCIAL_NOT_CONFIGURED', `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not available yet. Use your email and password.`);
  app.post('/api/auth/social/:provider/start', async (req, res, next: NextFunction) => {
    try {
      const provider = providerInput.parse(req.params.provider);
      const input = startInput.parse(req.body);
      const adapter = await adapterFor(provider);
      const actor = res.locals.actor as SessionUser | null;
      if (input.intent === 'login' && actor) return fail(409, 'ALREADY_SIGNED_IN', 'You are already signed in. Link another sign-in method from your account.');
      await rateLimitSocial(pool, 'start', req.ip ?? 'unknown');
      let userId: string | null = null;
      let sessionId: string | null = null;
      if (input.intent === 'link') {
        if (!actor || !res.locals.session?.session_id) return fail(401, 'AUTHENTICATION_REQUIRED', 'Sign in before linking another sign-in method.');
        const session = await one(pool, 'SELECT s.session_id,s.created_at,u.password_hash FROM seven.sessions s JOIN seven.users u USING(user_id) WHERE s.session_id=$1 AND s.user_id=$2 AND s.expires_at>now() AND u.is_active', [res.locals.session.session_id, actor.id]);
        if (!session) return fail(401, 'AUTHENTICATION_REQUIRED', 'Sign in before linking another sign-in method.');
        const recent = Date.now() - new Date(session.created_at).getTime() < 10 * 60 * 1000;
        if (input.currentPassword ? !await verifyPassword(input.currentPassword, session.password_hash) : !recent) return fail(401, 'REAUTHENTICATION_REQUIRED', 'Sign in again or confirm your password before linking another sign-in method.');
        userId = actor.id; sessionId = session.session_id;
      }
      const state = newToken(); const browser = newToken(); const nonce = newToken(); const codeVerifier = newToken();
      const returnPath = safeSocialReturnPath(input.returnTo, input.intent === 'link' ? '/app/profile' : '/app');
      const url = await adapter.authorizationUrl({ redirectUri: callbackUri(provider), state, nonce, codeVerifier });
      await pool.query('DELETE FROM seven.social_auth_challenges WHERE expires_at<now()-interval \'1 day\'');
      await pool.query("INSERT INTO seven.social_auth_challenges(challenge_id,state_hash,browser_hash,provider_code,nonce,code_verifier,return_path,linking_user_id,linking_session_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '10 minutes')", [randomUUID(), digestToken(state), digestToken(browser), provider, nonce, codeVerifier, returnPath, userId, sessionId]);
      res.cookie(cookieName(state), browser, cookieOptions);
      res.json({ data: { url } });
    } catch (error) { next(error); }
  });
  app.get('/api/auth/social/accounts', async (_req, res, next: NextFunction) => {
    try {
      const actor = res.locals.actor as SessionUser | null;
      if (!actor) return fail(401, 'AUTHENTICATION_REQUIRED', 'Sign in to see your sign-in methods.');
      const accounts = await rows(pool, 'SELECT provider_code AS provider,created_at AS "linkedAt" FROM seven.social_auth_identities WHERE user_id=$1 ORDER BY created_at', [actor.id]);
      res.json({ data: { accounts } });
    } catch (error) { next(error); }
  });
  const callback = async (req: Request, res: Response): Promise<void> => {
    let failureReturnPath: string | undefined;
    try {
      const provider = providerInput.parse(req.params.provider);
      if ((provider === 'apple' && req.method !== 'POST') || (provider === 'google' && req.method !== 'GET')) return fail(400, 'SOCIAL_STATE_INVALID', 'Start sign-in again.');
      const input = callbackInput.parse(provider === 'apple' ? req.body : req.query);
      await rateLimitSocial(pool, 'callback', req.ip ?? 'unknown');
      const browser = cookieValue(req, cookieName(input.state));
      if (!browser || !/^[A-Za-z0-9_-]{43}$/.test(browser)) return fail(400, 'SOCIAL_STATE_INVALID', 'Start sign-in again in this browser.');
      // Consume before token exchange. Provider timeouts require a fresh flow; no code is retried.
      const challenge = await one(pool, "UPDATE seven.social_auth_challenges SET used_at=now(),updated_at=now() WHERE state_hash=$1 AND browser_hash=$2 AND provider_code=$3 AND expires_at>now() AND used_at IS NULL RETURNING *", [digestToken(input.state), digestToken(browser), provider]);
      res.clearCookie(cookieName(input.state), cookieOptions);
      if (!challenge) return fail(400, 'SOCIAL_STATE_INVALID', 'This sign-in request has expired or was already used.');
      failureReturnPath = safeSocialReturnPath(challenge.return_path);
      if (input.error || !input.code) return fail(401, 'SOCIAL_CANCELLED', 'Sign-in was cancelled.');
      const adapter = await adapterFor(provider);
      const identity = await adapter.exchangeAndVerify({ code: input.code, redirectUri: callbackUri(provider), nonce: challenge.nonce, codeVerifier: challenge.code_verifier });
      const subject = z.string().min(1).max(255).parse(identity.subject);
      await transaction(pool, async db => {
        // Serialize the provider identity and normalized email to prevent duplicate accounts on concurrent callbacks.
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`social:${provider}:${subject}`]);
        const existing = await one(db, 'SELECT i.user_id,u.is_active FROM seven.social_auth_identities i JOIN seven.users u USING(user_id) WHERE provider_code=$1 AND provider_subject=$2 FOR UPDATE OF u', [provider, subject]);
        let userId: string;
        if (challenge.linking_user_id) {
          const session = await one(db, 'SELECT s.session_id FROM seven.sessions s JOIN seven.users u USING(user_id) WHERE s.session_id=$1 AND s.user_id=$2 AND s.expires_at>now() AND u.is_active FOR UPDATE OF u,s', [challenge.linking_session_id, challenge.linking_user_id]);
          if (!session) return fail(401, 'SOCIAL_REAUTHENTICATION_REQUIRED', 'Sign in again before linking this account.');
          if (existing && existing.user_id !== challenge.linking_user_id) return fail(409, 'SOCIAL_ALREADY_LINKED', 'This provider account is already linked to another 7even account.');
          userId = challenge.linking_user_id;
          const own = await one(db, 'SELECT provider_subject FROM seven.social_auth_identities WHERE user_id=$1 AND provider_code=$2', [userId, provider]);
          if (own && own.provider_subject !== subject) return fail(409, 'SOCIAL_ALREADY_LINKED', 'A different provider account is already linked.');
          if (!existing) {
            await db.query('INSERT INTO seven.social_auth_identities(identity_id,user_id,provider_code,provider_subject) VALUES($1,$2,$3,$4)', [randomUUID(), userId, provider, subject]);
            await audit(db, await userProjection(db, userId), null, 'account.social_linked', userId);
          }
        } else if (existing) {
          if (!existing.is_active) return fail(401, 'SOCIAL_ACCOUNT_UNAVAILABLE', 'This account is not available. Contact 7even support.');
          userId = existing.user_id;
        } else {
          const email = emailInput.safeParse(identity.email);
          if (!identity.emailVerified || !email.success) return fail(401, 'SOCIAL_EMAIL_UNVERIFIED', 'The provider must supply a verified email address to create your account.');
          await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`social-email:${email.data}`]);
          if (await one(db, 'SELECT user_id FROM seven.users WHERE lower(email)=$1', [email.data])) return fail(409, 'SOCIAL_EXISTING_ACCOUNT', 'Sign in with your existing password, then link this provider from your account.');
          userId = randomUUID();
          const displayName = identity.displayName?.trim().slice(0, 160) || email.data.split('@')[0] || '7even guest';
          await db.query("INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id) VALUES($1,$2,$3,'external',(SELECT role_id FROM seven.roles WHERE role_code='CUSTOMER'))", [userId, email.data, displayName]);
          await db.query('INSERT INTO seven.social_auth_identities(identity_id,user_id,provider_code,provider_subject) VALUES($1,$2,$3,$4)', [randomUUID(), userId, provider, subject]);
          await audit(db, null, null, 'account.created_social', userId);
        }
        const actor = await userProjection(db, userId);
        await audit(db, actor, null, challenge.linking_user_id ? 'account.social_link_completed' : 'account.social_signed_in', userId);
        await options.issueSession(db, res, userId);
      });
      const destination = new URL(safeSocialReturnPath(challenge.return_path), publicOrigin);
      if (challenge.linking_user_id) destination.searchParams.set('authSuccess', 'linked');
      res.redirect(303, destination.pathname + destination.search + destination.hash);
    } catch (error) {
      // Deliberately expose no token, provider response, account ID or raw error in URLs/logs.
      const codes: Record<string, string> = { SOCIAL_EXISTING_ACCOUNT: 'existing_account', SOCIAL_ALREADY_LINKED: 'already_linked', SOCIAL_EMAIL_UNVERIFIED: 'email_unverified', SOCIAL_CANCELLED: 'cancelled', SOCIAL_REAUTHENTICATION_REQUIRED: 'reauthenticate', SOCIAL_ACCOUNT_UNAVAILABLE: 'unavailable' };
      const code = error instanceof ApiError ? codes[error.code] ?? 'failed' : 'failed';
      const destination = new URLSearchParams({ authError: code });
      // Only the browser-bound stored attempt supplies this destination, never callback query data.
      if (failureReturnPath) destination.set('returnTo', failureReturnPath);
      res.redirect(303, `/login?${destination}`);
    }
  };
  app.get('/api/auth/social/:provider/callback', callback);
  app.post('/api/auth/social/:provider/callback', express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 10 }), callback);
}
