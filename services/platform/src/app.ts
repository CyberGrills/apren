import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import * as C from '@7even/contracts';
import { serviceDates, assessDemand, optimizeHotelBookings } from '@7even/engine';
import { createPool, transaction, one, rows, ApiError, fail, string } from './db.ts';
import type { Connection } from './db.ts';
import { hashPassword, verifyPassword, newToken, digestToken } from './auth.ts';
import { MockProvider, validWebhookSecret, parseProviderJson } from './provider.ts';
import type { PaymentProvider } from './provider.ts';
import {
  ProviderRegistry,
  providerFor,
  providerIds,
  executionModeIds,
  paymentMode,
} from './providerRegistry.ts';
import { MockCryptoGateway } from './cryptoProvider.ts';
import { validPaystackWebhook } from './paystackProvider.ts';
import { mountPaymentAccounts } from './paymentAccounts.ts';
import * as S from './store.ts';
import * as R from './reservations.ts';
import * as P from './payments.ts';
import * as B from './benefits.ts';
import { mountOperations } from './operations.ts';
import { mountAccountRoutes, rateLimitAiSearch, rateLimitLogin } from './accounts.ts';
import type { RecoveryMailer } from './accounts.ts';
import { configuredRecoveryMailer } from './recoveryMailer.ts';
import { interpretHotelSearch, isOpenAIConfigured, toHotelSearchParams } from './aiConcierge.ts';
import { processInbox, processOutbox } from './worker.ts';
import { findLocations, retainedLocationState } from './locations.ts';
import { listingReadiness } from './listingReadiness.ts';
import { mountAdminRecords } from './adminRecords.ts';

export interface AppOptions {
  pool?: Pool;
  provider?: PaymentProvider;
  providers?: ProviderRegistry;
  publicOrigin?: string;
  environment?: string;
  webhookSecret?: string;
  sendRecovery?: RecoveryMailer['sendRecovery'];
}
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const id = (req: Request): string => z.uuid().parse(req.params.id);
const parse = <T>(schema: z.ZodType<T>, req: Request): T => schema.parse(req.body);
const actorFor = (res: Response): C.SessionUser => {
  const actor = res.locals.actor as C.SessionUser | null;
  return actor ?? fail(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
};
const requireRole = (actor: C.SessionUser, allowed: C.Role[]): void => {
  if (!allowed.includes(actor.role))
    fail(403, 'FORBIDDEN', 'This account cannot perform that action.');
};

export function createApp(options: AppOptions = {}) {
  const pool = options.pool ?? createPool();
  const environment = options.environment ?? process.env.NODE_ENV ?? 'development';
  const deploymentOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
  const publicOrigin =
    options.publicOrigin ?? process.env.APP_ORIGIN ?? deploymentOrigin ?? 'http://127.0.0.1:5177';
  const allowedOrigins = new Set<string>(
    [
      publicOrigin,
      process.env.APP_ORIGIN,
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((value) => {
        const candidate = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
        try {
          return new URL(candidate).origin;
        } catch {
          return '';
        }
      })
      .filter((value) => value.length > 0),
  );
  const provider = options.providers ?? options.provider ?? new ProviderRegistry();
  if (
    environment === 'production' &&
    (provider.mode === 'mock' || !publicOrigin.startsWith('https://'))
  )
    throw new Error(
      'Production requires HTTPS and live payment mode. Mock payments are forbidden.',
    );
  if (
    environment === 'production' &&
    process.env.CRYPTO_ENABLED === 'true' &&
    process.env.BASE_RPC_URL &&
    process.env.CRYPTO_CHAIN_ID !== '8453'
  )
    throw new Error('Production crypto must use native USDC on Base mainnet after release review.');
  if (
    process.env.FLUTTERWAVE_WEBHOOK_SCHEME &&
    process.env.FLUTTERWAVE_WEBHOOK_SCHEME !== 'v3-verif-hash'
  )
    throw new Error(
      'This adapter supports only the explicitly selected Flutterwave v3 verif-hash protocol.',
    );
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy':
        _req.path === '/reset-password' ? 'no-referrer' : 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-store',
    });
    res.locals.requestId = randomUUID();
    next();
  });
  app.use(
    express.json({
      limit: '128kb',
      verify: (req, _res, buffer) => {
        (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
        (req as Request & { payloadHash?: string }).payloadHash = digestToken(
          buffer.toString('utf8'),
        );
      },
    }),
  );
  app.use(async (req, res, next) => {
    try {
      const token = req.headers.cookie
        ?.split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith('seven_session='))
        ?.slice(14);
      res.locals.actor = null;
      res.locals.csrf = null;
      if (token && token.length <= 100) {
        const session = await one(
          pool,
          'SELECT * FROM seven.sessions WHERE token_hash=$1 AND expires_at>now()',
          [digestToken(token)],
        );
        if (session) {
          res.locals.actor = await S.userProjection(pool, session.user_id);
          res.locals.csrf = digestToken(`csrf:${token}`);
          res.locals.session = session;
        }
      }
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        !['/api/webhooks/flutterwave', '/api/webhooks/paystack'].includes(req.path)
      ) {
        const origin = req.get('Origin');
        if (!origin || !allowedOrigins.has(origin))
          return fail(403, 'ORIGIN_REJECTED', 'This request must come from the 7even app.');
        if (
          res.locals.actor &&
          req.path !== '/api/auth/login' &&
          req.path !== '/api/auth/register'
        ) {
          const submitted = req.get('X-CSRF-Token');
          if (!submitted || digestToken(submitted) !== res.locals.session?.csrf_hash)
            return fail(403, 'CSRF_REJECTED', 'Refresh the page before trying again.');
        }
      }
      const previewReadOnly =
        process.env.SEVEN_PREVIEW_READ_ONLY === 'true' &&
        (process.env.VERCEL_ENV ?? environment) !== 'production';
      if (
        previewReadOnly &&
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        req.path !== '/api/ai/interpret-search'
      ) {
        return fail(
          503,
          'PREVIEW_READ_ONLY',
          'This preview is read-only. Account, booking, payment, refund, and webhook changes are disabled.',
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  });
  const sessionData = (res: Response): C.SessionData => ({
    user: res.locals.actor ?? null,
    csrfToken: res.locals.csrf ?? null,
    environment,
    paymentMode: provider.mode,
  });
  async function issueSession(
    db: Connection,
    res: Response,
    userId: string,
  ): Promise<C.SessionData> {
    const token = newToken();
    const csrf = digestToken(`csrf:${token}`);
    await db.query(
      "INSERT INTO seven.sessions(session_id,user_id,token_hash,csrf_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days')",
      [randomUUID(), userId, digestToken(token), digestToken(csrf)],
    );
    res.cookie('seven_session', token, {
      httpOnly: true,
      secure: publicOrigin.startsWith('https://') || Boolean(process.env.VERCEL_URL),
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 86400000,
    });
    res.locals.actor = await S.userProjection(db, userId);
    res.locals.csrf = csrf;
    return sessionData(res);
  }
  async function mutate<T>(
    req: Request,
    res: Response,
    work: (db: Connection, actor: C.SessionUser) => Promise<T>,
  ): Promise<T> {
    const actor = actorFor(res);
    const key = string(req.get('Idempotency-Key'), 'Idempotency key', 8, 200);
    const operation = `${req.method}:${req.path}`;
    const hash = digestToken(canonical(req.body ?? {}));
    return transaction(pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${actor.id}:${key}`]);
      const previous = await one(
        db,
        'SELECT * FROM seven.idempotencies WHERE user_id=$1 AND operation_key=$2',
        [actor.id, key],
      );
      if (previous) {
        const cached = previous.response_body as Record<string, unknown>;
        if (req.path.startsWith('/api/business/') && req.path !== '/api/business/applications') {
          requireRole(actor, ['BUSINESS_OWNER']);
          if (!actor.businessId) return fail(403, 'FORBIDDEN', 'Business access was revoked.');
        }
        if (
          typeof cached.businessId === 'string' &&
          cached.customerId !== actor.id &&
          cached.ownerId !== actor.id
        )
          S.requireTenant(actor, cached.businessId);
        if (req.path.includes('/reservations/') && typeof cached.id === 'string') {
          const current = await S.reservationProjection(db, cached.id);
          if (current) {
            await R.reservationAccess(db, actor, current);
            const offer = await S.offeringProjection(db, current.offeringId);
            if (offer) S.requireVenue(actor, offer.venueId);
          }
        }
        if (previous.operation_name !== operation || previous.payload_hash !== hash)
          return fail(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This request key was used for a different action.',
          );
        return previous.response_body as T;
      }
      const result = await work(db, actor);
      await db.query(
        'INSERT INTO seven.idempotencies(idempotency_id,user_id,operation_key,operation_name,payload_hash,response_body) VALUES($1,$2,$3,$4,$5,$6)',
        [randomUUID(), actor.id, key, operation, hash, result],
      );
      return result;
    });
  }
  async function financialMutation<T>(
    req: Request,
    res: Response,
    authorize: (actor: C.SessionUser) => Promise<void>,
    work: (actor: C.SessionUser) => Promise<T>,
  ): Promise<T> {
    const actor = actorFor(res);
    await authorize(actor);
    const key = string(req.get('Idempotency-Key'), 'Idempotency key', 8, 200);
    const operation = `${req.method}:${req.path}`;
    const hash = digestToken(canonical(req.body ?? {}));
    const claim = await transaction(pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${actor.id}:${key}`]);
      const previous = await one(
        db,
        'SELECT * FROM seven.idempotencies WHERE user_id=$1 AND operation_key=$2',
        [actor.id, key],
      );
      if (previous) {
        if (previous.operation_name !== operation || previous.payload_hash !== hash)
          return fail(
            409,
            'IDEMPOTENCY_CONFLICT',
            'This request key was used for a different action.',
          );
        return { fresh: false, body: previous.response_body };
      }
      await db.query(
        'INSERT INTO seven.idempotencies(idempotency_id,user_id,operation_key,operation_name,payload_hash,response_body) VALUES($1,$2,$3,$4,$5,$6)',
        [
          randomUUID(),
          actor.id,
          key,
          operation,
          hash,
          {
            __pending: true,
            ...(typeof req.body?.reference === 'string' ? { __reference: req.body.reference } : {}),
            ...(typeof req.body?.paymentId === 'string' ? { __paymentId: req.body.paymentId } : {}),
          },
        ],
      );
      return { fresh: true, body: { __pending: true } };
    });
    if (!claim.fresh) {
      let body = claim.body as Record<string, unknown>;
      for (let attempt = 0; body.__pending && attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        body = (await one(
          pool,
          'SELECT response_body FROM seven.idempotencies WHERE user_id=$1 AND operation_key=$2',
          [actor.id, key],
        ))!.response_body;
      }
      if (body.__pending)
        return fail(
          409,
          'OPERATION_PENDING',
          'This operation is still being reconciled. Check the current payment before trying again.',
        );
      if (body.__error) {
        const error = body.__error as { status: number; code: string; message: string };
        return fail(error.status, error.code, error.message);
      }
      return body as T;
    }
    try {
      const result = await work(actor);
      await pool.query(
        'UPDATE seven.idempotencies SET response_body=$3 WHERE user_id=$1 AND operation_key=$2',
        [actor.id, key, result],
      );
      return result;
    } catch (error) {
      const detail =
        error instanceof ApiError
          ? { status: error.status, code: error.code, message: error.message }
          : {
              status: 503,
              code: 'PAYMENT_UNKNOWN',
              message:
                'The provider outcome needs reconciliation. Check the current payment before another financial attempt.',
            };
      await pool.query(
        'UPDATE seven.idempotencies SET response_body=$3 WHERE user_id=$1 AND operation_key=$2',
        [actor.id, key, { __error: detail }],
      );
      return fail(detail.status, detail.code, detail.message);
    }
  }
  async function authorizeReservation(actor: C.SessionUser, reservationId: string): Promise<void> {
    const reservation = await S.reservationProjection(pool, reservationId);
    if (!reservation) return fail(404, 'NOT_FOUND', 'Reservation not found.');
    await R.reservationAccess(pool, actor, reservation);
  }
  function route(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    handler: (req: Request, res: Response) => Promise<unknown>,
  ) {
    app[method](`/api${path}`, async (req, res) => {
      const result = await handler(req, res);
      if (!res.headersSent) res.json({ data: result });
    });
  }
  route('get', '/health/live', async () => ({ status: 'ok' }));
  route('get', '/health/ready', async () => {
    await pool.query('SELECT 1 FROM seven.migrations LIMIT 1');
    return { status: 'ready', storage: 'postgresql', paymentMode: provider.mode };
  });
  route('post', '/ai/interpret-search', async (req) => {
    const input = z.strictObject({
      message: z.string().trim().min(2).max(2000),
    }).parse(req.body);
    // Vercel sanitizes these client-IP headers at its edge. Outside Vercel, use
    // Express's socket-derived IP and never trust caller-supplied forwarding headers.
    const forwardedIp = process.env.VERCEL
      ? (req.get('x-vercel-forwarded-for') ?? req.get('x-forwarded-for') ?? '').split(',')[0]?.trim()
      : undefined;
    await rateLimitAiSearch(pool, forwardedIp || req.ip || 'unknown');
    if (!isOpenAIConfigured())
      return fail(503, 'AI_NOT_CONFIGURED', 'AI search is not configured yet. Standard hotel search remains available.');
    try {
      const intent = await interpretHotelSearch(input.message);
      return {
        intent,
        searchParams: Object.fromEntries(toHotelSearchParams(intent)),
        provider: 'openai',
        model: process.env.OPENAI_MODEL?.trim(),
      };
    } catch {
      return fail(502, 'AI_PROVIDER_UNAVAILABLE', 'AI search is temporarily unavailable. Standard hotel search remains available.');
    }
  });
  route('get', '/engine/booking/health', async () => {
    const result = await one(
      pool,
      `SELECT count(*)::int AS total
       FROM seven.offerings o
       JOIN seven.businesses b USING(business_id)
       JOIN seven.sectors s USING(sector_id)
       WHERE o.is_published
         AND b.workflow_state_id=${S.sid('APPROVED')}
         AND s.sector_code='STAY'`,
    );
    return {
      engine: '7even-hotel-booking-engine',
      status: 'ok',
      inventorySource: 'postgresql-live',
      publishedHotelOffers: Number(result?.total ?? 0),
      capabilities: ['live-inventory-filtering', 'multi-night-availability', 'room-count-fit', 'explainable-match-ranking'],
      policyVersion: '7even-hotel-ranking-v1',
    };
  });
  route('get', '/auth/session', async (_req, res) => sessionData(res));
  route('post', '/auth/register', async (req, res) => {
    const input = parse(C.registerInput, req);
    await rateLimitLogin(pool, req.ip ?? 'unknown', input.email);
    const password = await hashPassword(input.password);
    return transaction(pool, async (db) => {
      if (await one(db, 'SELECT user_id FROM seven.users WHERE email=$1', [input.email]))
        return fail(409, 'EMAIL_REGISTERED', 'An account already uses this email.');
      const userId = randomUUID();
      await db.query(
        "INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id) VALUES($1,$2,$3,$4,(SELECT role_id FROM seven.roles WHERE role_code='CUSTOMER'))",
        [userId, input.email, input.displayName, password],
      );
      await S.audit(db, null, null, 'account.created', userId);
      return issueSession(db, res, userId);
    });
  });
  route('post', '/auth/login', async (req, res) => {
    const input = parse(C.loginInput, req);
    await rateLimitLogin(pool, req.ip ?? 'unknown', input.email);
    return transaction(pool, async (db) => {
      const user = await one(
        db,
        'SELECT * FROM seven.users WHERE email=$1 AND is_active FOR UPDATE',
        [input.email],
      );
      if (!user || !(await verifyPassword(input.password, user.password_hash)))
        return fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      return issueSession(db, res, user.user_id);
    });
  });
  route('post', '/auth/logout', async (req, res) =>
    mutate(req, res, async (db) => {
      await db.query('DELETE FROM seven.sessions WHERE session_id=$1', [
        res.locals.session.session_id,
      ]);
      res.clearCookie('seven_session', { path: '/' });
      return { success: true };
    }),
  );
  route('patch', '/me', async (req, res) => {
    const input = parse(C.profileInput, req);
    return mutate(req, res, async (db, actor) => {
      await db.query(
        'UPDATE seven.users SET display_name=$2,phone=$3,updated_at=now() WHERE user_id=$1',
        [actor.id, input.displayName, input.phone ?? ''],
      );
      return S.userProjection(db, actor.id);
    });
  });

  route('get', '/directory', async (req) => {
    const kind = z.enum(['ALL', 'STAY', 'DINING', 'EXPERIENCE']).parse(
      typeof req.query.kind === 'string' ? req.query.kind.toUpperCase() : 'ALL',
    );
    const state = req.query.state === undefined
      ? ''
      : z.string().trim().max(100).parse(req.query.state);
    const searchText = req.query.q === undefined
      ? ''
      : z.string().trim().max(160).parse(req.query.q);
    const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize) || 100));
    const where = `listing_status='DIRECTORY_ONLY' AND is_bookable=false
      AND ($1='ALL' OR kind=$1)
      AND ($2='' OR state_name=$2)
      AND ($3='' OR lower(concat_ws(' ',display_name,state_name,city,area,address_text)) LIKE '%' || lower($3) || '%')`;
    const [states, totalRow, listings] = await Promise.all([
      rows<{ stateName: string; capital: string; region: string; hotelDirectoryUrl: string }>(
        pool,
        `SELECT state_name AS "stateName", capital, region,
                hotel_directory_url AS "hotelDirectoryUrl"
         FROM seven.state_directories WHERE is_active ORDER BY state_name COLLATE "C"`,
      ),
      one<{ total: number }>(
        pool,
        `SELECT count(*)::int AS total FROM seven.discovery_listings WHERE ${where}`,
        [kind, state, searchText],
      ),
      rows(
        pool,
        `SELECT discovery_listing_id::text AS id, kind, display_name AS name,
                state_name AS state, city, area, address_text AS address,
                description, image_url AS "imageUrl", image_source_url AS "imageSourceUrl",
                split_part(split_part(image_source_url, '://', 2), '/', 1) AS "imageSourceName",
                source_name AS "sourceName", source_url AS "sourceUrl",
                'DIRECTORY_ONLY'::text AS status, false AS bookable, source_checked_at AS "sourceCheckedAt"
         FROM seven.discovery_listings WHERE ${where}
         ORDER BY state_name COLLATE "C", city COLLATE "C", display_name COLLATE "C"
         LIMIT $4 OFFSET $5`,
        [kind, state, searchText, pageSize, (page - 1) * pageSize],
      ),
    ]);
    return { states, listings, total: totalRow?.total ?? 0, page, pageSize };
  });
  route('get', '/locations', async (req) => {
    const query = z.string().trim().max(160).parse(req.query.q ?? '');
    const state = C.nigeriaStateInput.parse(req.query.state) ?? '';
    const limit = z.coerce.number().int().min(1).max(30).parse(req.query.limit ?? 8);
    return findLocations(query, state, limit);
  });
  route('get', '/offerings', async (req) => {
    const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
    const size = Math.max(1, Math.min(100, Number(req.query.pageSize) || 30));
    const requestedKind = String(req.query.kind ?? '');
    const city = req.query.city === undefined ? '' : z.string().trim().max(160).parse(req.query.city);
    const state = C.nigeriaStateInput.parse(req.query.state) ?? '';

    if (requestedKind === 'STAY') {
      const businessVerificationGate =
        environment === 'production'
          ? `b.details #>> '{verificationReview,checklistVersion}' = '1'`
          : `(b.details #>> '{verificationReview,checklistVersion}' = '1' OR b.details->>'isSample' = 'true')`;
      const inventoryFreshnessGate =
        environment === 'production'
          ? `w.inventory_confirmed_at > now() - (COALESCE((b.details #>> '{verificationReview,inventoryFreshnessHours}')::int, 0) * interval '1 hour')`
          : `(b.details->>'isSample' = 'true' OR w.inventory_confirmed_at > now() - (COALESCE((b.details #>> '{verificationReview,inventoryFreshnessHours}')::int, 0) * interval '1 hour'))`;
      const startDate = req.query.startDate === undefined
        ? undefined
        : z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.startDate);
      const endDate = req.query.endDate === undefined
        ? undefined
        : z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.endDate);
      if (endDate && !startDate)
        return fail(422, 'CHECK_IN_REQUIRED', 'Choose a check-in date before check-out.');
      const rooms = z.coerce.number().int().min(1).max(100).parse(req.query.rooms ?? '1');
      const maxBaseTotalMinor = req.query.maxBaseTotalMinor === undefined
        ? undefined
        : z.string().regex(/^(0|[1-9]\d{0,14})$/).parse(req.query.maxBaseTotalMinor);
      const amenityText = req.query.amenities === undefined
        ? ''
        : z.string().max(1600).parse(req.query.amenities);
      const amenities = amenityText
        ? amenityText.split(',').map((value) => z.string().trim().min(1).max(80).parse(value)).slice(0, 20)
        : [];

      return transaction(pool, async (searchDb) => {
        await searchDb.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      // Scan eligible IDs in stable keyset batches. A first pass collects the
      // global normalization statistics used by ranking-v1; a second pass ranks
      // batches with those same statistics and retains only the requested top-K.
      const searchStartedAt = performance.now();
      const batchSize = 200;
      const asOf = new Date().toISOString();
      const baseCriteria = {
        checkInDate: startDate,
        checkOutDate: endDate,
        rooms,
        city: city || undefined,
        amenities,
        maxBaseTotalMinor,
        asOf,
      };
      const candidateSql = `WITH raw_batch AS (
         SELECT o.offering_id
         FROM seven.offerings o
         JOIN seven.businesses b USING(business_id)
         JOIN seven.sectors s USING(sector_id)
         WHERE o.is_published
           AND b.workflow_state_id=${S.sid('APPROVED')}
           AND s.sector_code='STAY'
           AND ${businessVerificationGate}
           AND ($7='' OR lower(btrim(o.details->>'state'))=lower($7))
           AND ($1='' OR ($7='' AND lower(o.city) LIKE $1) OR ($7<>'' AND lower(btrim(o.city))=$1))
           AND ($5::uuid IS NULL OR o.offering_id > $5::uuid)
         ORDER BY o.offering_id
         LIMIT $6
       ),
       inventory_by_offering AS (
         SELECT w.offering_id,
           bool_or(
             w.ends_at > now()
             AND w.capacity > w.allocated_count
           ) AS has_available_window,
           count(DISTINCT (w.starts_at + interval '1 hour')::date) FILTER (
             WHERE w.ends_at > now()
               AND w.capacity - w.allocated_count >= $4
               AND $2::date IS NOT NULL
           ) AS nights_with_capacity
         FROM seven.inventory_windows w
         JOIN raw_batch rb USING(offering_id)
         JOIN seven.offerings o USING(offering_id)
         JOIN seven.businesses b USING(business_id)
         WHERE ${inventoryFreshnessGate}
           AND (w.starts_at + interval '1 hour')::date >=
             COALESCE($2::date, (now() AT TIME ZONE 'Africa/Lagos')::date)
           AND ($2::date IS NULL OR (w.starts_at + interval '1 hour')::date <
               COALESCE($3::date, $2::date + 1))
         GROUP BY w.offering_id
       )
       SELECT rb.offering_id,
         (
           COALESCE(ibo.has_available_window, false)
           AND (
             $2::date IS NULL OR
             COALESCE(ibo.nights_with_capacity, 0) =
               (COALESCE($3::date, $2::date + 1) - $2::date)
           )
         ) AS eligible
       FROM raw_batch rb
       LEFT JOIN inventory_by_offering ibo USING(offering_id)
       ORDER BY rb.offering_id`;
      const candidateValues = (cursor: string | null) => [
        city ? (state ? city.toLowerCase() : `%${city.toLowerCase()}%`) : '',
        startDate ?? null,
        endDate ?? null,
        rooms,
        cursor,
        batchSize,
        state,
      ];
      const scanBatches = async (
        visit: (ids: string[]) => Promise<void>,
      ): Promise<{ count: number; queryMs: number }> => {
        let cursor: string | null = null;
        let count = 0;
        let queryMs = 0;
        while (true) {
          const queryStartedAt = performance.now();
          const found: Array<{ offering_id: string; eligible: boolean }> = await rows<{ offering_id: string; eligible: boolean }>(
            searchDb,
            candidateSql,
            candidateValues(cursor),
          );
          queryMs += performance.now() - queryStartedAt;
          if (found.length === 0) break;
          // Advance the cursor past every raw listing, not only eligible listings,
          // so mixed inventories cannot cause repeated scans or skipped rows.
          const ids = found
            .filter((row) => row.eligible)
            .map((row) => String(row.offering_id));
          if (ids.length > 0) {
            await visit(ids);
            count += ids.length;
          }
          cursor = String(found[found.length - 1]!.offering_id);
          if (found.length < batchSize) break;
        }
        return { count, queryMs };
      };

      const globalStatsAccumulator: {
        minTotal: bigint | null;
        maxTotal: bigint | null;
        maxRooms: number;
      } = { minTotal: null, maxTotal: null, maxRooms: 0 };
      let projectedOfferings = 0;
      let secondPassProjectedOfferings = 0;
      let eligibleRankedCount = 0;
      let projectionMs = 0;
      let rankingMs = 0;
      const firstPass = await scanBatches(async (ids) => {
        const projectionStartedAt = performance.now();
        const offerings = await S.offeringProjections(searchDb, ids, true);
        projectionMs += performance.now() - projectionStartedAt;
        projectedOfferings += offerings.length;
        const rankingStartedAt = performance.now();
        const batchRanked = optimizeHotelBookings(
          offerings.map((offer) => ({
            id: offer.id,
            title: offer.title,
            city: offer.city,
            priceMinor: offer.priceMinor,
            amenities: offer.amenities,
            windows: offer.windows,
          })),
          baseCriteria,
        );
        rankingMs += performance.now() - rankingStartedAt;
        eligibleRankedCount += batchRanked.length;
        for (const item of batchRanked) {
          const total = BigInt(item.estimatedBaseTotalMinor);
          globalStatsAccumulator.minTotal = globalStatsAccumulator.minTotal === null || total < globalStatsAccumulator.minTotal ? total : globalStatsAccumulator.minTotal;
          globalStatsAccumulator.maxTotal = globalStatsAccumulator.maxTotal === null || total > globalStatsAccumulator.maxTotal ? total : globalStatsAccumulator.maxTotal;
          globalStatsAccumulator.maxRooms = Math.max(globalStatsAccumulator.maxRooms, item.roomsAvailable);
        }
      });

      const topK = page * size;
      type RankedHotel = ReturnType<typeof optimizeHotelBookings>[number];
      const top: Array<{ item: RankedHotel; hotel: C.Offering }> = [];
      const compareRanked = (a: RankedHotel, b: RankedHotel) =>
        b.matchScore - a.matchScore
        || (BigInt(a.estimatedBaseTotalMinor) < BigInt(b.estimatedBaseTotalMinor) ? -1
          : BigInt(a.estimatedBaseTotalMinor) > BigInt(b.estimatedBaseTotalMinor) ? 1 : 0)
        || b.roomsAvailable - a.roomsAvailable
        || a.id.localeCompare(b.id);
      let secondPassCandidates = 0;
      let secondPassQueryMs = 0;
      if (globalStatsAccumulator.minTotal !== null && globalStatsAccumulator.maxTotal !== null && globalStatsAccumulator.maxRooms > 0) {
        const rankingStats = {
          minEstimatedBaseTotalMinor: globalStatsAccumulator.minTotal.toString(),
          maxEstimatedBaseTotalMinor: globalStatsAccumulator.maxTotal.toString(),
          maxRoomsAvailable: globalStatsAccumulator.maxRooms,
        };
        const secondPass = await scanBatches(async (ids) => {
          const projectionStartedAt = performance.now();
          const offerings = await S.offeringProjections(searchDb, ids, true);
          projectionMs += performance.now() - projectionStartedAt;
          secondPassProjectedOfferings += offerings.length;
          secondPassCandidates += ids.length;
          const rankingStartedAt = performance.now();
          const batchRanked: RankedHotel[] = optimizeHotelBookings(
            offerings.map((offer) => ({
              id: offer.id,
              title: offer.title,
              city: offer.city,
              priceMinor: offer.priceMinor,
              amenities: offer.amenities,
              windows: offer.windows,
            })),
            baseCriteria,
            rankingStats,
          );
          rankingMs += performance.now() - rankingStartedAt;
          const byId = new Map(offerings.map((offer) => [offer.id, offer]));
          for (const item of batchRanked) {
            const hotel = byId.get(item.id);
            if (hotel) top.push({ item, hotel });
          }
          top.sort((a, b) => compareRanked(a.item, b.item));
          if (top.length > topK) top.length = topK;
        });
        secondPassQueryMs = secondPass.queryMs;
      }
      const candidateQueryMs = Math.round((firstPass.queryMs + secondPassQueryMs) * 100) / 100;
      projectionMs = Math.round(projectionMs * 100) / 100;
      rankingMs = Math.round(rankingMs * 100) / 100;
      const rankedResults = top.map(({ item }) => item);
      console.info(JSON.stringify({
        event: 'seven.hotel_search.measurement',
        policyVersion: '7even-hotel-ranking-v1',
        city: city || null,
        dateScoped: !!startDate,
        candidates: firstPass.count,
        candidateBatchSize: batchSize,
        candidateEligibilityStrategy: 'set-based-grouped-inventory',

        candidatePasses: globalStatsAccumulator.minTotal === null ? 1 : 2,
        candidateCap: null,
        candidateCapReached: false,
        projectedOfferings,
        secondPassProjectedOfferings,
        projectionRowsRead: projectedOfferings + secondPassProjectedOfferings,
        secondPassCandidates,
        rankedResults: eligibleRankedCount,
        returnedResults: rankedResults.length,
        candidateQueryMs,
        projectionMs,
        rankingMs,
        totalMs: Math.round((performance.now() - searchStartedAt) * 100) / 100,
      }));
      return top.slice((page - 1) * size, page * size).map(({ item, hotel }) => {
        const bookingOptimization = {
          checkInDate: item.checkInDate,
          checkOutDate: item.checkOutDate,
          nights: item.nights,
          roomsRequested: item.roomsRequested,
          roomsAvailable: item.roomsAvailable,
          estimatedBaseTotalMinor: item.estimatedBaseTotalMinor,
          matchScore: item.matchScore,
          reasons: item.reasons,
          checkedAt: item.checkedAt,
          policyVersion: item.policyVersion,
        };
        return { ...hotel, bookingOptimization };
      });
      });
    }

    const genericStayVerificationGate =
      environment === 'production'
        ? `b.details #>> '{verificationReview,checklistVersion}' = '1'`
        : `(b.details #>> '{verificationReview,checklistVersion}' = '1' OR b.details->>'isSample' = 'true')`;
    const genericInventoryFreshnessGate =
      environment === 'production'
        ? `w.inventory_confirmed_at > now() - (COALESCE((b.details #>> '{verificationReview,inventoryFreshnessHours}')::int, 0) * interval '1 hour')`
        : `(b.details->>'isSample' = 'true' OR w.inventory_confirmed_at > now() - (COALESCE((b.details #>> '{verificationReview,inventoryFreshnessHours}')::int, 0) * interval '1 hour'))`;
    const found = await rows(
      pool,
      `SELECT o.offering_id, s.sector_code
       FROM seven.offerings o
       JOIN seven.businesses b USING(business_id)
       JOIN seven.sectors s USING(sector_id)
       WHERE o.is_published
         AND b.workflow_state_id=${S.sid('APPROVED')}
         AND (
           s.sector_code <> 'STAY'
           OR (
             ${genericStayVerificationGate}
             AND EXISTS (
               SELECT 1
               FROM seven.inventory_windows w
               WHERE w.offering_id=o.offering_id
                 AND w.ends_at>now()
                 AND w.capacity>w.allocated_count
                 AND ${genericInventoryFreshnessGate}
             )
           )
         )
         AND ($5='' OR lower(btrim(o.details->>'state'))=lower($5))
         AND ($1='' OR ($5='' AND lower(o.city) LIKE $1) OR ($5<>'' AND lower(btrim(o.city))=$1))
         AND ($2='' OR s.sector_code=$2)
       ORDER BY o.created_at
       LIMIT $3 OFFSET $4`,
      [
        city ? (state ? city.toLowerCase() : `%${city.toLowerCase()}%`) : '',
        requestedKind,
        size,
        (page - 1) * size,
        state,
      ],
    );
    const offerings = (
      await Promise.all(
        found.map((row) =>
          S.offeringProjection(pool, row.offering_id, row.sector_code === 'STAY'),
        ),
      )
    ).filter((offer): offer is C.Offering => !!offer);
    if (!req.query.startDate) return offerings;
    const genericStartDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.startDate);
    const genericEndDate = req.query.endDate === undefined
      ? undefined
      : z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.endDate);
    return offerings.filter((offer) => {
      const dates =
        offer.kind === 'STAY' && genericEndDate ? serviceDates(genericStartDate, genericEndDate) : [genericStartDate];
      return dates.every((date) =>
        offer.windows.some(
          (window) =>
            window.serviceDate === date &&
            window.remaining > 0 &&
            Date.parse(window.endAt) > Date.now(),
        ),
      );
    });
  });
  route('get', '/offerings/:id', async (req, res) => {
    let offer = await S.offeringProjection(pool, id(req));
    if (!offer) return fail(404, 'NOT_FOUND', 'Offering not found.');
    const b = await S.businessProjection(pool, offer.businessId);
    let verifiedStay = offer.kind !== 'STAY' || Boolean(environment !== 'production' && b?.isSample);
    if (offer.kind === 'STAY' && !verifiedStay) {
      const review = await one<{ checklist_version: string | null }>(
        pool,
        "SELECT details #>> '{verificationReview,checklistVersion}' AS checklist_version FROM seven.businesses WHERE business_id=$1",
        [offer.businessId],
      );
      verifiedStay = review?.checklist_version === '1';
    }
    const publicEligible = offer.published && b?.status === 'APPROVED' && verifiedStay;
    if (!publicEligible) {
      const actor = actorFor(res);
      S.requireTenant(actor, offer.businessId);
      S.requireVenue(actor, offer.venueId);
    } else if (offer.kind === 'STAY') {
      offer = (await S.offeringProjection(pool, offer.id, true)) ?? offer;
    }
    return offer;
  });
  route('post', '/quotes', async (req, res) => {
    const input = parse(C.quoteInput, req);
    return mutate(req, res, (db, actor) => R.createQuote(db, actor, input, environment === 'production'));
  });
  route('post', '/reservations', async (req, res) => {
    const input = parse(C.reservationInput, req);
    return mutate(req, res, (db, actor) => R.createReservation(db, actor, input.quoteId, false, actor.id, environment === 'production'));
  });
  route('get', '/reservations/:id', async (req, res) => {
    const r = await S.reservationProjection(pool, id(req));
    if (!r) return fail(404, 'NOT_FOUND', 'Reservation not found.');
    await R.reservationAccess(pool, actorFor(res), r);
    return r;
  });
  route('post', '/reservations/:id/actions', async (req, res) => {
    const input = parse(C.reservationActionInput, req);
    return mutate(req, res, (db, actor) => R.actOnReservation(db, actor, id(req), input));
  });
  route('get', '/reservations/:id/payment-options', async (req, res) =>
    P.paymentOptions(pool, provider, actorFor(res), id(req)),
  );
  route('post', '/reservations/:id/checkout', async (req, res) => {
    const input = parse(C.checkoutInput, req);
    return financialMutation(
      req,
      res,
      (actor) => authorizeReservation(actor, id(req)),
      (actor) => P.checkout(pool, provider, actor, id(req), publicOrigin, input),
    );
  });
  route('get', '/payments/:id/checkout', async (req, res) => {
    const row = await one(
      pool,
      'SELECT * FROM seven.payment_attempts WHERE payment_attempt_id=$1',
      [id(req)],
    );
    if (!row) return fail(404, 'NOT_FOUND', 'Payment not found.');
    await authorizeReservation(actorFor(res), row.reservation_id);
    const payment = (await S.paymentProjection(pool, row.payment_attempt_id))!;
    if (payment.mode !== paymentMode(provider, payment.provider))
      return fail(
        409,
        'PROVIDER_MODE_CHANGED',
        'This payment belongs to a different execution mode.',
      );
    if (['PAID', 'REFUNDED', 'REFUND_PENDING', 'REVIEW_REQUIRED'].includes(payment.status))
      return fail(
        409,
        'PAYMENT_RECORDED',
        'This payment already has a recorded outcome. Open your booking to review it.',
      );
    if (!row.checkout_url)
      return fail(
        409,
        'PAYMENT_PENDING',
        'Checkout is being reconciled. Check its status before another payment.',
      );
    return {
      paymentId: row.payment_attempt_id,
      reference: row.merchant_reference,
      checkoutUrl: row.checkout_url,
      mode: payment.mode,
      provider: payment.provider,
      method: payment.method,
    } satisfies C.Checkout;
  });
  route('get', '/payments/:id', async (req, res) => {
    const p = await S.paymentProjection(pool, id(req));
    if (!p) return fail(404, 'NOT_FOUND', 'Payment not found.');
    await R.reservationAccess(
      pool,
      actorFor(res),
      (await S.reservationProjection(pool, p.reservationId))!,
    );
    return p;
  });
  route('post', '/payments/verify', async (req, res) => {
    const input = parse(C.paymentVerifyInput, req);
    return financialMutation(
      req,
      res,
      async (actor) => {
        const payment = await one(
          pool,
          'SELECT reservation_id FROM seven.payment_attempts WHERE merchant_reference=$1',
          [input.reference],
        );
        if (!payment) return fail(404, 'NOT_FOUND', 'Payment not found.');
        await authorizeReservation(actor, payment.reservation_id);
      },
      (actor) =>
        P.verifyPayment(
          pool,
          provider,
          actor,
          input.reference,
          input.transactionId,
          input.walletSignature,
        ),
    );
  });
  route('post', '/payments/:id/dev-complete', async (req, res) => {
    if (provider.mode !== 'mock' || environment === 'production')
      return fail(404, 'NOT_FOUND', 'This route is unavailable.');
    const outcome = z
      .strictObject({ outcome: z.enum(['SUCCESS', 'FAILURE']) })
      .parse(req.body).outcome;
    const payment = await S.paymentProjection(pool, id(req));
    if (!payment) return fail(404, 'NOT_FOUND', 'Payment not found.');
    return financialMutation(
      req,
      res,
      (actor) => authorizeReservation(actor, payment.reservationId),
      async (actor) => {
        if (payment.provider === 'crypto') {
          if (
            !(provider instanceof ProviderRegistry) ||
            !(provider.crypto instanceof MockCryptoGateway) ||
            !payment.crypto
          )
            return fail(404, 'NOT_FOUND', 'Mock crypto is unavailable.');
          if (outcome === 'FAILURE') {
            await pool.query(
              `UPDATE seven.payment_attempts SET workflow_state_id=${S.sid('FAILED')} WHERE payment_attempt_id=$1`,
              [payment.id],
            );
            await pool.query(
              `UPDATE seven.reservations SET payment_state_id=${S.sid('FAILED')} WHERE reservation_id=$1`,
              [payment.reservationId],
            );
            return S.paymentProjection(pool, payment.id);
          }
          const hash = provider.crypto.complete(
            payment.crypto.quote,
            payment.crypto.transactionHash ?? undefined,
          );
          await pool.query(
            'UPDATE seven.crypto_payment_quotes SET payer_verified_at=coalesce(payer_verified_at,now()) WHERE payment_attempt_id=$1',
            [payment.id],
          );
          return P.verifyPayment(pool, provider, actor, payment.reference, hash);
        }
        const adapter = providerFor(provider, payment.provider);
        if (!(adapter instanceof MockProvider))
          return fail(404, 'NOT_FOUND', 'Mock completion is unavailable.');
        adapter.receipts.set(payment.reference, {
          id: `local-${payment.id}`,
          reference: payment.reference,
          status: outcome === 'SUCCESS' ? 'successful' : 'failed',
          currency: 'NGN',
          amountMinor: Number(payment.amountMinor),
          feeMinor: 0,
        });
        return P.verifyPayment(pool, provider, actor, payment.reference);
      },
    );
  });
  route('post', '/payments/:id/dev-refund-complete', async (req, res) => {
    if (provider.mode !== 'mock' || environment === 'production')
      return fail(404, 'NOT_FOUND', 'This route is unavailable.');
    return financialMutation(
      req,
      res,
      async (actor) => {
        const p = await S.paymentProjection(pool, id(req));
        if (!p) return fail(404, 'NOT_FOUND', 'Payment not found.');
        await authorizeReservation(actor, p.reservationId);
      },
      (actor) => P.verifyCryptoRefund(pool, provider, actor, id(req), undefined, true),
    );
  });
  route('post', '/payments/:id/crypto-refund', async (req, res) => {
    const input = parse(C.cryptoRefundInput, req);
    return financialMutation(
      req,
      res,
      async (actor) => {
        const payment = await S.paymentProjection(pool, id(req));
        if (!payment) return fail(404, 'NOT_FOUND', 'Payment not found.');
        await authorizeReservation(actor, payment.reservationId);
        const reservation = (await S.reservationProjection(pool, payment.reservationId))!;
        S.requireTenant(actor, reservation.businessId, true);
      },
      (actor) => P.verifyCryptoRefund(pool, provider, actor, id(req), input.transactionHash),
    );
  });
  route('post', '/reservations/:id/refunds', async (req, res) => {
    const input = z
      .strictObject({ reason: z.string().min(3).max(500), paymentId: z.uuid().optional() })
      .parse(req.body);
    return financialMutation(
      req,
      res,
      async (actor) => {
        await authorizeReservation(actor, id(req));
        const r = (await S.reservationProjection(pool, id(req)))!;
        S.requireTenant(actor, r.businessId, true);
      },
      (actor) => P.requestRefund(pool, provider, actor, id(req), input.reason, input.paymentId),
    );
  });
  async function receiveWebhook(
    req: Request,
    res: Response,
    providerId: 'flutterwave' | 'paystack',
  ) {
    const adapter = providerFor(provider, providerId);
    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
    const authenticated =
      adapter.mode === providerId &&
      (providerId === 'flutterwave'
        ? validWebhookSecret(
            req.get('verif-hash'),
            options.webhookSecret ?? process.env.FLUTTERWAVE_WEBHOOK_SECRET ?? '',
          )
        : validPaystackWebhook(
            raw,
            req.get('x-paystack-signature'),
            process.env.PAYSTACK_SECRET_KEY ?? '',
          ));
    if (!authenticated) return fail(401, 'WEBHOOK_REJECTED', 'Webhook authentication failed.');
    const event = z
      .object({
        event: z.string().max(100),
        data: z.object({
          id: z.union([z.string(), z.number()]),
          tx_ref: z.string().max(150).optional(),
          reference: z.string().max(150).optional(),
          status: z.string().max(80),
        }),
      })
      .parse(parseProviderJson(raw.toString('utf8')));
    if (providerId === 'paystack' && event.event !== 'charge.success')
      return { received: true, ignored: true };
    const reference = providerId === 'paystack' ? event.data.reference : event.data.tx_ref;
    if (!reference || !/^[1-9]\d{0,39}$/.test(String(event.data.id)))
      return fail(422, 'INVALID_EVENT', 'Provider event identity is invalid.');
    const payment = await one(
      pool,
      'SELECT payment_provider_id FROM seven.payment_attempts WHERE merchant_reference=$1',
      [reference],
    );
    if (!payment || Number(payment.payment_provider_id) !== providerIds[providerId])
      return fail(409, 'WRONG_PROVIDER', 'The event does not match a payment for this provider.');
    await pool.query(
      'INSERT INTO seven.provider_events(provider_event_id,event_reference,event_code,details,payment_provider_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(payment_provider_id,event_reference) DO NOTHING',
      [
        randomUUID(),
        `${event.event}:${event.data.id}:${event.data.status}`,
        event.event,
        {
          id: String(event.data.id),
          reference,
          fingerprint: (req as Request & { payloadHash?: string }).payloadHash,
        },
        providerIds[providerId],
      ],
    );
    res.json({ data: { received: true } });
    setImmediate(() => {
      void processInbox(pool, provider).catch(() => undefined);
    });
    return undefined;
  }
  route('post', '/webhooks/flutterwave', (req, res) => receiveWebhook(req, res, 'flutterwave'));
  route('post', '/webhooks/paystack', (req, res) => receiveWebhook(req, res, 'paystack'));
  route('get', '/me/overview', async (_req, res): Promise<C.CustomerOverview> => {
    const actor = actorFor(res);
    const rs = await rows(
      pool,
      'SELECT reservation_id FROM seven.reservations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [actor.id],
    );
    const es = await rows(
      pool,
      'SELECT entitlement_id FROM seven.entitlements WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [actor.id],
    );
    const ts = await rows(
      pool,
      'SELECT exchange_id FROM seven.exchanges WHERE proposer_user_id=$1 OR recipient_user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [actor.id],
    );
    const ps = await rows(
      pool,
      'SELECT p.payment_attempt_id FROM seven.payment_attempts p JOIN seven.reservations r USING(reservation_id) WHERE r.user_id=$1 ORDER BY p.created_at DESC LIMIT 100',
      [actor.id],
    );
    return {
      reservations: (
        await Promise.all(rs.map((r) => S.reservationProjection(pool, r.reservation_id)))
      ).filter((r): r is C.Reservation => !!r),
      points: await S.pointsProjection(pool, actor.id),
      benefits: (
        await Promise.all(es.map((r) => S.benefitProjection(pool, r.entitlement_id)))
      ).filter((r): r is C.Benefit => !!r),
      trades: (await Promise.all(ts.map((r) => S.tradeProjection(pool, r.exchange_id)))).filter(
        (r): r is C.Trade => !!r,
      ),
      notifications: await S.notifications(pool, actor.id),
      payments: (
        await Promise.all(ps.map((r) => S.paymentProjection(pool, r.payment_attempt_id)))
      ).filter((r): r is C.Payment => !!r),
    };
  });
  route('get', '/rewards', async () => {
    const found = await rows(
      pool,
      `SELECT r.reward_id FROM seven.rewards r JOIN seven.businesses b USING(business_id) WHERE r.is_published AND r.expires_at>now() AND b.workflow_state_id=${S.sid('APPROVED')} ORDER BY r.created_at LIMIT 100`,
    );
    return Promise.all(found.map((r) => S.rewardProjection(pool, r.reward_id)));
  });
  route('post', '/rewards/:id/redeem', async (req, res) =>
    mutate(req, res, (db, actor) => B.redeem(db, actor, id(req))),
  );
  route('post', '/benefits/:id/consume', async (req, res) => {
    const input = parse(C.benefitConsumeInput, req);
    return mutate(req, res, (db, actor) =>
      B.consume(db, actor, id(req), input.code, input.expectedRevision),
    );
  });
  route('post', '/trades', async (req, res) => {
    const input = parse(C.tradeInput, req);
    return mutate(req, res, (db, actor) => B.proposeTrade(db, actor, input));
  });
  route('post', '/trades/:id/actions', async (req, res) => {
    const input = parse(C.tradeActionInput, req);
    return mutate(req, res, (db, actor) =>
      B.actTrade(db, actor, id(req), input.action, input.expectedRevision),
    );
  });
  route('post', '/notifications/:id/read', async (req, res) =>
    mutate(req, res, async (db, actor) => {
      const found = await one(
        db,
        'UPDATE seven.notifications SET read_at=coalesce(read_at,now()),updated_at=now() WHERE notification_id=$1 AND user_id=$2 RETURNING notification_id',
        [id(req), actor.id],
      );
      if (!found) return fail(404, 'NOT_FOUND', 'Notification not found.');
      return (await S.notifications(db, actor.id)).find((n) => n.id === found.notification_id)!;
    }),
  );

  route('post', '/business/applications', async (req, res) => {
    const input = parse(C.businessApplicationInput, req);
    return mutate(req, res, async (db, actor) => {
      requireRole(actor, ['CUSTOMER']);
      if (actor.businessId)
        return fail(409, 'ALREADY_MEMBER', 'This account already belongs to a business.');
      const businessId = randomUUID();
      const venueId = randomUUID();
      await db.query(
        `INSERT INTO seven.businesses(business_id,business_name,slug,city,description,workflow_state_id,details) VALUES($1,$2,$3,$4,$5,${S.sid('PENDING')},$6)`,
        [
          businessId,
          input.businessName,
          `${input.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 65)}-${businessId.slice(0, 8)}`,
          input.city,
          input.description,
          { address: input.address, phone: input.phone, sector: input.sector, isSample: false, state: input.state ?? null },
        ],
      );
      await db.query(
        'INSERT INTO seven.venues(venue_id,business_id,venue_name,address_line,city) VALUES($1,$2,$3,$4,$5)',
        [venueId, businessId, input.businessName, input.address, input.city],
      );
      await db.query(
        "INSERT INTO seven.memberships(membership_id,user_id,business_id,role_id) VALUES($1,$2,$3,(SELECT role_id FROM seven.roles WHERE role_code='BUSINESS_OWNER'))",
        [randomUUID(), actor.id, businessId],
      );
      await db.query('INSERT INTO seven.sources(source_id,user_id,business_id) VALUES($1,$2,$3)', [
        randomUUID(),
        actor.id,
        businessId,
      ]);
      await S.audit(db, actor, businessId, 'business.applied', businessId);
      return S.businessProjection(db, businessId);
    });
  });
  async function businessActor(res: Response, ownerOnly = false): Promise<C.SessionUser> {
    const actor = actorFor(res);
    requireRole(actor, ownerOnly ? ['BUSINESS_OWNER'] : ['BUSINESS_OWNER', 'RECEPTION']);
    if (!actor.businessId)
      return fail(403, 'BUSINESS_REQUIRED', 'This account has no business membership.');
    return actor;
  }
  async function businessReservations(actor: C.SessionUser): Promise<C.Reservation[]> {
    const found = await rows(
      pool,
      'SELECT reservation_id FROM seven.reservations WHERE business_id=$1 AND ($2::boolean OR offering_id IN (SELECT offering_id FROM seven.offerings WHERE venue_id=ANY($3::uuid[]))) ORDER BY created_at DESC LIMIT 200',
      [actor.businessId, actor.role !== 'RECEPTION', actor.venueIds],
    );
    return (
      await Promise.all(found.map((r) => S.reservationProjection(pool, r.reservation_id)))
    ).filter((r): r is C.Reservation => !!r);
  }
  async function businessOffers(businessId: string): Promise<C.Offering[]> {
    return (
      await Promise.all(
        (
          await rows(
            pool,
            'SELECT offering_id FROM seven.offerings WHERE business_id=$1 ORDER BY created_at',
            [businessId],
          )
        ).map((r) => S.offeringProjection(pool, r.offering_id, false, { upcomingInventoryOnly: true })),
      )
    ).filter((o): o is C.Offering => !!o);
  }
  async function demand(businessId: string): Promise<C.DemandView[]> {
    const offers = await businessOffers(businessId);
    const now = new Date().toISOString();
    return Promise.all(
      offers.map(async (offer) => {
        const counts = await rows(
          pool,
          "SELECT event_code,count(*)::int AS total,min(observed_at) AS first_at FROM seven.observations WHERE business_id=$1 AND offering_id=$2 AND NOT is_synthetic AND observed_at>now()-interval '7 days' GROUP BY event_code",
          [businessId, offer.id],
        );
        const evidence = Object.fromEntries(
          counts.map((c) => [c.event_code.toLowerCase(), Number(c.total)]),
        );
        const future = offer.published
          ? offer.windows.filter((w) => new Date(w.endAt) > new Date())
          : [];
        const capacity = future.reduce((sum, w) => sum + w.capacity, 0);
        const allocated = future.reduce((sum, w) => sum + w.capacity - w.remaining, 0);
        const assessment = assessDemand({
          searches: evidence.search ?? 0,
          quotes: evidence.quote ?? 0,
          confirmed: evidence.confirmed ?? 0,
          cancelled: evidence.cancelled ?? 0,
          fulfilled: evidence.fulfilled ?? 0,
          capacity,
          allocated,
          goal: 'BALANCED',
          asOf: now,
          periodStart: new Date(Date.now() - 7 * 86400000).toISOString(),
          minSamples: 20,
        });
        return {
          offeringId: offer.id,
          title: offer.title,
          assessment: {
            ...assessment,
            evidence: {
              ...assessment.evidence,
              occupancyBps: assessment.evidence.occupancyBps ?? 0,
              conversionBps: assessment.evidence.conversionBps ?? 0,
            },
          },
        } as C.DemandView;
      }),
    );
  }
  route('get', '/business/overview', async (_req, res): Promise<C.BusinessOverview> => {
    const actor = await businessActor(res, true);
    const businessId = actor.businessId!;
    const rewardIds = await rows(
      pool,
      'SELECT reward_id FROM seven.rewards WHERE business_id=$1 ORDER BY created_at DESC',
      [businessId],
    );
    const staffIds = await rows(
      pool,
      'SELECT user_id FROM seven.memberships WHERE business_id=$1 AND is_active',
      [businessId],
    );
    return {
      business: await S.businessProjection(pool, businessId),
      offerings: await businessOffers(businessId),
      reservations: await businessReservations(actor),
      rewards: (
        await Promise.all(rewardIds.map((r) => S.rewardProjection(pool, r.reward_id)))
      ).filter((r): r is C.Reward => !!r),
      metrics: await S.metrics(pool, businessId),
      demand: await demand(businessId),
      activity: await S.activities(pool, businessId),
      staff: (await Promise.all(staffIds.map((r) => S.userProjection(pool, r.user_id)))).filter(
        (u): u is C.SessionUser => !!u,
      ),
      notifications: await S.notifications(pool, actor.id),
      listingReadiness: await listingReadiness(pool, { businessId, production: environment === 'production' }),
    };
  });
  async function saveOffering(
    db: Connection,
    actor: C.SessionUser,
    input: z.infer<typeof C.offeringInput>,
    existingId?: string,
    revision?: number,
  ) {
    if (!actor.businessId) return fail(403, 'BUSINESS_REQUIRED', 'Business membership required.');
    S.requireTenant(actor, actor.businessId, true);
    const business = await S.businessProjection(db, actor.businessId);
    if (business?.status !== 'APPROVED')
      return fail(
        403,
        'APPROVAL_REQUIRED',
        'Your business must be approved before publishing offerings.',
      );
    const venue = input.venueId
      ? await one(
          db,
          'SELECT venue_id FROM seven.venues WHERE venue_id=$1 AND business_id=$2 AND is_active FOR SHARE',
          [input.venueId, actor.businessId],
        )
      : await one(
          db,
          'SELECT venue_id FROM seven.venues WHERE business_id=$1 AND is_active ORDER BY created_at LIMIT 1 FOR SHARE',
          [actor.businessId],
        );
    if (!venue) return fail(422, 'INVALID_VENUE', 'Choose a venue belonging to this business.');
    const offeringId = existingId ?? randomUUID();
    let state = input.state ?? null;
    if (existingId) {
      const old = await one(db, 'SELECT * FROM seven.offerings WHERE offering_id=$1 FOR UPDATE', [
        existingId,
      ]);
      if (!old) return fail(404, 'NOT_FOUND', 'Offering not found.');
      S.requireTenant(actor, old.business_id, true);
      state = input.state === undefined && old.venue_id !== venue.venue_id
        ? null
        : retainedLocationState(input, { city: old.city, state: old.details.state });
      const sector = (
        await one(db, 'SELECT sector_code FROM seven.sectors WHERE sector_id=$1', [old.sector_id])
      )?.sector_code;
      if (
        (old.venue_id !== venue.venue_id || sector !== input.kind) &&
        (await one(
          db,
          'SELECT reservation_id FROM seven.reservations WHERE offering_id=$1 LIMIT 1',
          [existingId],
        ))
      )
        return fail(
          409,
          'OFFERING_IN_USE',
          'Create a separate offering to change the venue or service kind after reservations exist.',
        );
      if (revision !== old.revision)
        return fail(409, 'REVISION_CONFLICT', 'Refresh this offering before editing.');
    }
    const details = {
      address: input.address,
      state,
      capacity: input.capacity,
      images: input.images,
      amenities: input.amenities,
      cancellationHours: input.cancellationHours,
      discountBps: input.discountBps,
    };
    if (existingId)
      await db.query(
        'UPDATE seven.offerings SET venue_id=$2,sector_id=(SELECT sector_id FROM seven.sectors WHERE sector_code=$3),title=$4,description=$5,city=$6,price_minor=$7,tax_bps=$8,is_published=$9,details=$10,revision=revision+1,updated_at=now() WHERE offering_id=$1',
        [
          offeringId,
          venue.venue_id,
          input.kind,
          input.title,
          input.description,
          input.city,
          input.priceMinor,
          input.taxBps,
          input.published,
          details,
        ],
      );
    else
      await db.query(
        'INSERT INTO seven.offerings(offering_id,business_id,venue_id,sector_id,title,description,city,price_minor,tax_bps,is_published,details) VALUES($1,$2,$3,(SELECT sector_id FROM seven.sectors WHERE sector_code=$4),$5,$6,$7,$8,$9,$10,$11)',
        [
          offeringId,
          actor.businessId,
          venue.venue_id,
          input.kind,
          input.title,
          input.description,
          input.city,
          input.priceMinor,
          input.taxBps,
          input.published,
          details,
        ],
      );
    await S.audit(
      db,
      actor,
      actor.businessId,
      existingId ? 'offering.updated' : 'offering.created',
      offeringId,
    );
    return S.offeringProjection(db, offeringId);
  }
  route('post', '/business/offerings', async (req, res) => {
    const input = parse(C.offeringInput, req);
    return mutate(req, res, (db, actor) => saveOffering(db, actor, input));
  });
  route('patch', '/business/offerings/:id', async (req, res) => {
    const input = C.offeringInput.parse(
      Object.fromEntries(Object.entries(req.body).filter(([key]) => key !== 'expectedRevision')),
    );
    const revision = z.int().min(1).parse(req.body.expectedRevision);
    return mutate(req, res, (db, actor) => saveOffering(db, actor, input, id(req), revision));
  });
  route('post', '/business/offerings/:id/availability', async (req, res) => {
    const input = parse(C.availabilityInput, req);
    return mutate(req, res, async (db, actor) => {
      const offer = await S.offeringProjection(db, id(req));
      if (!offer) return fail(404, 'NOT_FOUND', 'Offering not found.');
      S.requireTenant(actor, offer.businessId, true);
      const dates =
        offer.kind === 'STAY'
          ? serviceDates(
              input.startDate,
              input.endDate ??
                new Date(Date.parse(`${input.startDate}T00:00:00Z`) + 86400000)
                  .toISOString()
                  .slice(0, 10),
            )
          : [input.startDate];
      for (const date of dates) {
        const start =
          offer.kind === 'STAY'
            ? `${date}T00:00:00+01:00`
            : (input.startAt ?? `${date}T18:00:00+01:00`);
        const end =
          offer.kind === 'STAY'
            ? new Date(Date.parse(start) + 86400000).toISOString()
            : (input.endAt ?? new Date(Date.parse(start) + 7200000).toISOString());
        if (!Number.isFinite(Date.parse(start)) || Date.parse(end) <= Date.parse(start))
          return fail(422, 'INVALID_WINDOW', 'Choose a valid service window.');
        const previous = await one(
          db,
          'SELECT * FROM seven.inventory_windows WHERE offering_id=$1 AND starts_at=$2 FOR UPDATE',
          [offer.id, start],
        );
        if (
          previous &&
          ((input.expectedRevision !== undefined && previous.revision !== input.expectedRevision) ||
            previous.allocated_count > input.capacity ||
            (previous.allocated_count > 0 && S.iso(previous.ends_at) !== S.iso(end)))
        )
          return fail(
            409,
            'CAPACITY_CHANGED',
            'This window changed or already has more allocated capacity.',
          );
        if (previous)
          await db.query(
            'UPDATE seven.inventory_windows SET capacity=$2,ends_at=$3,revision=revision+1,updated_at=now(),inventory_confirmed_at=now() WHERE inventory_window_id=$1',
            [previous.inventory_window_id, input.capacity, end],
          );
        else
          await db.query(
            'INSERT INTO seven.inventory_windows(inventory_window_id,offering_id,starts_at,ends_at,capacity,inventory_confirmed_at) VALUES($1,$2,$3,$4,$5,now())',
            [randomUUID(), offer.id, start, end, input.capacity],
          );
      }
      await S.audit(db, actor, offer.businessId, 'availability.updated', offer.id);
      return S.offeringProjection(db, offer.id);
    });
  });
  route('post', '/business/rewards', async (req, res) => {
    const input = parse(C.rewardInput, req);
    return mutate(req, res, async (db, actor) => {
      await businessActor(res, true);
      const business = await S.businessProjection(db, actor.businessId!);
      if (business?.status !== 'APPROVED' || Date.parse(input.expiresAt) <= Date.now())
        return fail(
          409,
          'REWARD_UNAVAILABLE',
          'Use an approved business and a future reward expiry.',
        );
      const rewardId = randomUUID();
      await db.query(
        'INSERT INTO seven.rewards(reward_id,business_id,title,description,points_cost,remaining_count,initial_capacity,expires_at,is_transferable,is_published) VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9)',
        [
          rewardId,
          actor.businessId,
          input.title,
          input.description,
          input.pointsCost,
          input.capacity,
          input.expiresAt,
          input.transferable,
          input.published,
        ],
      );
      await S.audit(db, actor, actor.businessId, 'reward.created', rewardId);
      return S.rewardProjection(db, rewardId);
    });
  });
  route('post', '/business/staff', async (req, res) => {
    const input = parse(C.staffInput, req);
    const password = await hashPassword(input.password);
    return mutate(req, res, async (db, actor) => {
      await businessActor(res, true);
      if (await one(db, 'SELECT user_id FROM seven.users WHERE email=$1', [input.email]))
        return fail(409, 'EMAIL_REGISTERED', 'This email already has an account.');
      if (
        input.venueId &&
        !(await one(
          db,
          'SELECT venue_id FROM seven.venues WHERE venue_id=$1 AND business_id=$2 AND is_active FOR SHARE',
          [input.venueId, actor.businessId],
        ))
      )
        return fail(422, 'INVALID_VENUE', 'This venue does not belong to your business.');
      const userId = randomUUID();
      await db.query(
        "INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id) VALUES($1,$2,$3,$4,(SELECT role_id FROM seven.roles WHERE role_code='RECEPTION'))",
        [userId, input.email, input.displayName, password],
      );
      await db.query(
        "INSERT INTO seven.memberships(membership_id,user_id,business_id,role_id,venue_id) VALUES($1,$2,$3,(SELECT role_id FROM seven.roles WHERE role_code='RECEPTION'),$4)",
        [randomUUID(), userId, actor.businessId, input.venueId ?? null],
      );
      await db.query('INSERT INTO seven.sources(source_id,user_id,business_id) VALUES($1,$2,$3)', [
        randomUUID(),
        userId,
        actor.businessId,
      ]);
      await S.audit(db, actor, actor.businessId, 'staff.added', userId);
      return S.userProjection(db, userId);
    });
  });
  route('delete', '/business/staff/:id', async (req, res) =>
    mutate(req, res, async (db, actor) => {
      await businessActor(res, true);
      const member = await one(
        db,
        "SELECT m.* FROM seven.memberships m JOIN seven.roles r USING(role_id) WHERE m.user_id=$1 AND m.business_id=$2 AND r.role_code='RECEPTION' FOR UPDATE OF m",
        [id(req), actor.businessId],
      );
      if (!member) return fail(404, 'NOT_FOUND', 'Staff member not found.');
      await db.query(
        'UPDATE seven.memberships SET is_active=false,updated_at=now() WHERE membership_id=$1',
        [member.membership_id],
      );
      await db.query('DELETE FROM seven.sessions WHERE user_id=$1', [id(req)]);
      await db.query(
        'UPDATE seven.sources SET is_active=false,updated_at=now() WHERE user_id=$1 AND business_id=$2',
        [id(req), actor.businessId],
      );
      await S.audit(db, actor, actor.businessId, 'staff.revoked', id(req));
      return { success: true };
    }),
  );

  route('get', '/reception/overview', async (_req, res): Promise<C.ReceptionOverview> => {
    const actor = await businessActor(res);
    const source = await one(
      pool,
      'SELECT source_id FROM seven.sources WHERE user_id=$1 AND business_id=$2 AND is_active',
      [actor.id, actor.businessId],
    );
    return {
      business: await (async () => {
        const business = await S.businessProjection(pool, actor.businessId!);
        if (!business) return null;
        const view = { ...business };
        delete view.paymentAccounts;
        delete view.cryptoCommissionOwedMinor;
        return view;
      })(),
      offerings: (await businessOffers(actor.businessId!)).filter(
        (offer) => actor.role !== 'RECEPTION' || actor.venueIds.includes(offer.venueId),
      ),
      reservations: await businessReservations(actor),
      metrics: await S.metrics(
        pool,
        actor.businessId!,
        actor.role === 'RECEPTION' ? actor.venueIds : undefined,
      ),
      activity: await S.activities(
        pool,
        actor.businessId!,
        actor.role === 'RECEPTION' ? actor.venueIds : undefined,
      ),
      sourceId: source?.source_id ?? '',
      serverTime: new Date().toISOString(),
    };
  });
  route('post', '/reception/walk-ins', async (req, res) => {
    const input = parse(C.walkInInput, req);
    return mutate(req, res, async (db, actor) => {
      await businessActor(res);
      let customer = await one(db, 'SELECT user_id FROM seven.users WHERE email=$1', [
        input.customerEmail,
      ]);
      if (!customer) {
        const customerId = randomUUID();
        await db.query(
          "INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id) VALUES($1,$2,$3,$4,(SELECT role_id FROM seven.roles WHERE role_code='CUSTOMER'))",
          [customerId, input.customerEmail, input.customerName, await hashPassword(newToken())],
        );
        customer = { user_id: customerId };
      }
      return R.createReservation(db, actor, input.quoteId, true, customer.user_id, environment === 'production');
    });
  });
  route('post', '/reception/sync', async (req, res): Promise<C.SyncResult> => {
    const input = parse(C.receptionEventInput, req);
    const actor = await businessActor(res);
    string(req.get('Idempotency-Key'), 'Idempotency key', 8, 200);
    const source = await one(
      pool,
      'SELECT source_id FROM seven.sources WHERE source_id=$1 AND business_id=$2 AND user_id=$3 AND is_active',
      [input.sourceId, actor.businessId, actor.id],
    );
    if (!source)
      return fail(
        403,
        'SOURCE_REJECTED',
        'This reception source is not authorized for your account.',
      );
    return financialMutation(
      req,
      res,
      async () => undefined,
      async () => {
        const outcomes: C.SyncResult['outcomes'] = [];
        for (const event of input.events) {
          try {
            const outcome = await transaction(pool, async (db) => {
              await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
                `sync:${source.source_id}:${event.eventId}`,
              ]);
              const hash = digestToken(canonical(event));
              const previous = await one(
                db,
                'SELECT * FROM seven.sync_events WHERE business_id=$1 AND device_id=$2 AND client_event_id=$3',
                [actor.businessId, source.source_id, event.eventId],
              );
              if (previous) {
                if (previous.payload_hash !== hash)
                  return fail(
                    409,
                    'SYNC_IDENTITY_CONFLICT',
                    'The event identity was reused with different data.',
                  );
                return {
                  ...previous.result_body,
                  status:
                    previous.result_body.status === 'APPLIED'
                      ? 'DUPLICATE'
                      : previous.result_body.status,
                } as C.SyncResult['outcomes'][number];
              }
              const reservation = await R.actOnReservation(db, actor, event.reservationId, {
                action: event.action,
                expectedRevision: event.expectedRevision,
                ...(event.reason ? { reason: event.reason } : {}),
              });
              const result: C.SyncResult['outcomes'][number] = {
                eventId: event.eventId,
                status: 'APPLIED',
                reservation,
              };
              await db.query(
                'INSERT INTO seven.sync_events(sync_event_id,user_id,business_id,device_id,client_event_id,event_version,payload_hash,result_body) VALUES($1,$2,$3,$4,$5,1,$6,$7)',
                [
                  randomUUID(),
                  actor.id,
                  actor.businessId,
                  source.source_id,
                  event.eventId,
                  hash,
                  result,
                ],
              );
              return result;
            });
            outcomes.push(outcome);
          } catch (error) {
            const result: C.SyncResult['outcomes'][number] = {
              eventId: event.eventId,
              status: error instanceof ApiError && error.status === 409 ? 'CONFLICT' : 'REJECTED',
              message:
                error instanceof ApiError ? error.message : 'This change could not be applied.',
            };
            await pool.query(
              'INSERT INTO seven.sync_events(sync_event_id,user_id,business_id,device_id,client_event_id,event_version,payload_hash,result_body) VALUES($1,$2,$3,$4,$5,1,$6,$7) ON CONFLICT(business_id,device_id,client_event_id) DO NOTHING',
              [
                randomUUID(),
                actor.id,
                actor.businessId,
                source.source_id,
                event.eventId,
                digestToken(canonical(event)),
                result,
              ],
            );
            outcomes.push(result);
          }
        }
        return { serverTime: new Date().toISOString(), outcomes };
      },
    );
  });

  async function adminOverview(): Promise<C.AdminOverview> {
    const businesses = (
      await Promise.all(
        (
          await rows(pool, 'SELECT business_id FROM seven.businesses ORDER BY created_at DESC')
        ).map((r) => S.businessProjection(pool, r.business_id)),
      )
    ).filter((b): b is C.Business => !!b);
    const reservations = (
      await Promise.all(
        (
          await rows(
            pool,
            'SELECT reservation_id FROM seven.reservations ORDER BY created_at DESC LIMIT 200',
          )
        ).map((r) => S.reservationProjection(pool, r.reservation_id)),
      )
    ).filter((r): r is C.Reservation => !!r);
    const payments = (
      await Promise.all(
        (
          await rows(
            pool,
            'SELECT payment_attempt_id FROM seven.payment_attempts ORDER BY created_at DESC LIMIT 200',
          )
        ).map((r) => S.paymentProjection(pool, r.payment_attempt_id)),
      )
    ).filter((p): p is C.Payment => !!p);
    const policy = (await one(
      pool,
      'SELECT * FROM seven.policies ORDER BY policy_id DESC LIMIT 1',
    ))!;
    const unresolvedPayments = await rows(
      pool,
      `SELECT p.payment_attempt_id,p.merchant_reference,p.created_at,s.workflow_state_code
       FROM seven.payment_attempts p JOIN seven.workflow_states s USING(workflow_state_id)
       WHERE s.workflow_state_code IN ('UNKNOWN','REVIEW_REQUIRED')
       ORDER BY p.created_at,p.payment_attempt_id LIMIT 100`,
    );
    const refunds = await rows(
      pool,
      `SELECT r.*,s.workflow_state_code FROM seven.refunds r JOIN seven.workflow_states s USING(workflow_state_id) WHERE s.workflow_state_code IN ('UNKNOWN','FAILED','DISPATCHED') OR r.provider_details->>'exception' IS NOT NULL ORDER BY r.created_at,r.refund_id LIMIT 100`,
    );
    const exceptions = [
      ...unresolvedPayments
        .map((p) => ({
          id: p.payment_attempt_id,
          kind: 'PAYMENT',
          message: `${p.merchant_reference}: ${p.workflow_state_code}. Reconcile before another financial attempt.`,
          createdAt: S.iso(p.created_at),
        })),
      ...refunds.map((r) => ({
        id: r.refund_id,
        kind: 'REFUND',
        message: `Refund ${r.workflow_state_code}. ${r.provider_details.exception ?? 'Never blindly retry a dispatched refund.'}`,
        createdAt: S.iso(r.created_at),
      })),
    ];
    const inbox = await rows(
      pool,
      'SELECT provider_event_id,event_reference,last_error,created_at FROM seven.provider_events WHERE processed_at IS NULL AND (attempts>=5 OR last_error IS NOT NULL) ORDER BY created_at LIMIT 100',
    );
    const settlementProblems = await rows(
      pool,
      "SELECT payment_attempt_id,provider_details,created_at FROM seven.payment_attempts WHERE provider_details ? 'settlementException' AND provider_details->>'settlementException' IS NOT NULL ORDER BY created_at LIMIT 100",
    );
    exceptions.push(
      ...inbox.map((event) => ({
        id: event.provider_event_id,
        kind: 'PROVIDER_EVENT',
        message: `${event.event_reference}: ${event.last_error ?? 'Verification attempts exhausted. Review the provider event.'}`,
        createdAt: S.iso(event.created_at),
      })),
      ...settlementProblems.map((p) => ({
        id: p.payment_attempt_id,
        kind: 'SETTLEMENT',
        message: String(p.provider_details.settlementException),
        createdAt: S.iso(p.created_at),
      })),
    );
    const exceptionCounts = await one<{ total: number }>(pool, `SELECT (
      (SELECT count(*) FROM seven.payment_attempts p JOIN seven.workflow_states s USING(workflow_state_id)
        WHERE s.workflow_state_code IN ('UNKNOWN','REVIEW_REQUIRED')) +
      (SELECT count(*) FROM seven.refunds r JOIN seven.workflow_states s USING(workflow_state_id)
        WHERE s.workflow_state_code IN ('UNKNOWN','FAILED','DISPATCHED') OR r.provider_details->>'exception' IS NOT NULL) +
      (SELECT count(*) FROM seven.provider_events WHERE processed_at IS NULL AND (attempts>=5 OR last_error IS NOT NULL)) +
      (SELECT count(*) FROM seven.payment_attempts WHERE provider_details ? 'settlementException' AND provider_details->>'settlementException' IS NOT NULL)
    )::int AS total`);
    return {
      businesses,
      reservations,
      payments,
      metrics: await S.metrics(pool),
      activity: await S.activities(pool),
      policy: {
        version: Number(policy.policy_id),
        earnSpendMinor: policy.earn_spend_minor,
        earnPoints: policy.earn_points,
        holdMinutes: policy.hold_minutes,
        commissionBps: 1000,
      },
      exceptions,
      exceptionsSummary: {
        total: exceptionCounts?.total ?? 0,
        shown: exceptions.length,
        truncated: (exceptionCounts?.total ?? 0) > exceptions.length,
        perCategoryLimit: 100,
      },
      listingReadiness: await listingReadiness(pool, { production: environment === 'production' }),
    };
  }
  route('get', '/admin/overview', async (_req, res) => {
    requireRole(actorFor(res), ['ADMIN']);
    return adminOverview();
  });
  route('get', '/admin/listing-readiness', async (req, res): Promise<C.ListingReadiness> => {
    requireRole(actorFor(res), ['ADMIN']);
    const businessId = req.query.businessId === undefined ? undefined : z.uuid().parse(req.query.businessId);
    return listingReadiness(pool, { businessId, production: environment === 'production' });
  });
  route('post', '/admin/businesses/:id/status', async (req, res) => {
    requireRole(actorFor(res), ['ADMIN']);
    const input = parse(C.businessStatusInput, req);
    return mutate(req, res, async (db, actor) => {
      requireRole(actor, ['ADMIN']);
      const businessId = id(req);
      const current = await one<{ details: Record<string, unknown> }>(
        db,
        'SELECT details FROM seven.businesses WHERE business_id=$1 FOR UPDATE',
        [businessId],
      );
      if (!current) return fail(404, 'NOT_FOUND', 'Business not found.');

      let details = current.details ?? {};
      const businessSector =
        typeof details.sector === 'string' ? details.sector : 'STAY';
      if (input.status === 'APPROVED' && businessSector === 'STAY') {
        const verification = input.verification;
        if (!verification)
          return fail(
            409,
            'VERIFICATION_REQUIRED',
            'Complete the hotel verification checklist and attach evidence references before approval.',
          );
        const evidenceItems = [
          verification.propertyExists,
          verification.partnerAuthority,
          verification.directContact,
          verification.fullAddress,
          verification.coordinates,
          verification.currentRates,
          verification.roomInventoryAndPolicies,
        ];
        if (
          evidenceItems.some((item) => !item.confirmed || !item.evidenceReference.trim())
        )
          return fail(
            409,
            'VERIFICATION_INCOMPLETE',
            'Every hotel verification item must be confirmed with an evidence reference.',
          );
        details = {
          ...details,
          verificationReview: {
            checklistVersion: 1,
            evidence: verification,
            inventoryFreshnessHours: verification.inventoryFreshnessHours,
            reviewedAt: new Date().toISOString(),
            reviewedBy: actor.id,
          },
        };
      }

      const found = await one(
        db,
        `UPDATE seven.businesses SET workflow_state_id=${S.sid(input.status)},details=$2::jsonb,revision=revision+1,updated_at=now() WHERE business_id=$1 RETURNING business_id`,
        [businessId, JSON.stringify(details)],
      );
      if (!found) return fail(404, 'NOT_FOUND', 'Business not found.');
      await S.audit(
        db,
        actor,
        businessId,
        `business.${input.status.toLowerCase()}`,
        businessId,
        input.reason,
      );
      return S.businessProjection(db, businessId);
    });
  });
  route('post', '/admin/businesses/:id/subaccount', async (req, res) => {
    const actor = actorFor(res);
    requireRole(actor, ['ADMIN']);
    const input = parse(C.subaccountInput, req);
    const adapter = providerFor(provider, input.provider);
    const verified = await adapter.subaccount(input.subaccountCode);
    if (String(verified.subaccount_id) !== input.subaccountCode)
      return fail(409, 'SUBACCOUNT_MISMATCH', 'Provider did not verify this business subaccount.');
    if (
      adapter.mode !== 'mock' &&
      (!/^\d{10}$/.test(String(verified.account_number ?? '')) ||
        (verified.currency && verified.currency !== 'NGN') ||
        (verified.country && verified.country !== 'NG') ||
        verified.active === false ||
        (input.provider === 'paystack' &&
          verified.domain !== (environment === 'production' ? 'live' : 'test')))
    )
      return fail(
        409,
        'SUBACCOUNT_REVIEW',
        'Review the active Nigerian settlement account and provider environment.',
      );
    return mutate(req, res, async (db) => {
      const business = await one(
        db,
        'SELECT business_id FROM seven.businesses WHERE business_id=$1 FOR UPDATE',
        [id(req)],
      );
      if (!business) return fail(404, 'NOT_FOUND', 'Business not found.');
      const details = {
        settlementAccount: verified.account_number ?? null,
        settlementBankCode: verified.account_bank ?? null,
        providerRawId: verified.providerRawId ?? null,
        bankName: verified.bankName ?? null,
        providerBankId: verified.providerBankId ?? null,
      };
      await db.query(
        `INSERT INTO seven.business_payment_accounts(business_payment_account_id,business_id,payment_provider_id,account_code,account_label,execution_mode_id,revision,workflow_state_id,details,verified_at) VALUES($1,$2,$3,$4,$5,$6,1,${S.sid('APPROVED')},$7,now()) ON CONFLICT(business_id,payment_provider_id) DO UPDATE SET account_code=excluded.account_code,account_label=excluded.account_label,execution_mode_id=excluded.execution_mode_id,revision=seven.business_payment_accounts.revision+1,workflow_state_id=excluded.workflow_state_id,details=excluded.details,verified_at=now(),updated_at=now()`,
        [
          randomUUID(),
          id(req),
          providerIds[input.provider],
          input.subaccountCode,
          input.accountLabel,
          executionModeIds[adapter.mode],
          details,
        ],
      );
      if (input.provider === 'flutterwave')
        await db.query(
          'UPDATE seven.businesses SET subaccount_id=$2,bank_revision=bank_revision+1,details=details||$3::jsonb,updated_at=now() WHERE business_id=$1',
          [
            id(req),
            input.subaccountCode,
            JSON.stringify({
              accountLabel: input.accountLabel,
              subaccountVerifiedAt: new Date().toISOString(),
              subaccountMode: adapter.mode,
              ...details,
            }),
          ],
        );
      await S.audit(
        db,
        actor,
        id(req),
        'business.payment_account_verified',
        id(req),
        input.provider,
      );
      return S.businessProjection(db, id(req));
    });
  });
  mountPaymentAccounts({ route, mutate, pool, source: provider, actorFor, requireRole, id });
  route('post', '/admin/policy', async (req, res) => {
    requireRole(actorFor(res), ['ADMIN']);
    const input = parse(C.policyInput, req);
    return mutate(req, res, async (db, actor) => {
      requireRole(actor, ['ADMIN']);
      const p = (await one(
        db,
        'INSERT INTO seven.policies(earn_spend_minor,earn_points,hold_minutes,reason) VALUES($1,$2,$3,$4) RETURNING *',
        [input.earnSpendMinor, input.earnPoints, input.holdMinutes, input.reason],
      ))!;
      await S.audit(db, actor, null, 'policy.changed', String(p.policy_id), input.reason);
      return {
        version: Number(p.policy_id),
        earnSpendMinor: p.earn_spend_minor,
        earnPoints: p.earn_points,
        holdMinutes: p.hold_minutes,
        commissionBps: 1000,
      };
    });
  });
  route('post', '/admin/reconcile', async (req, res) =>
    financialMutation(
      req,
      res,
      async (actor) => requireRole(actor, ['ADMIN']),
      async () => {
        const inbox = await processInbox(pool, provider);
        const result = await P.reconcile(pool, provider);
        await processOutbox(pool);
        return { ...result, processed: result.processed + inbox };
      },
    ),
  );
  route('post', '/admin/provider-events/:id/retry', async (req, res) => {
    requireRole(actorFor(res), ['ADMIN']);
    const input = z.strictObject({ reason: z.string().min(5).max(500) }).parse(req.body);
    return mutate(req, res, async (db, actor) => {
      requireRole(actor, ['ADMIN']);
      const event = await one(
        db,
        'SELECT * FROM seven.provider_events WHERE provider_event_id=$1 FOR UPDATE',
        [id(req)],
      );
      if (!event) return fail(404, 'NOT_FOUND', 'Provider event not found.');
      if (event.processed_at)
        return fail(409, 'EVENT_COMPLETE', 'This provider event was already processed.');
      if (event.lease_expires_at && new Date(event.lease_expires_at) > new Date())
        return fail(409, 'EVENT_CLAIMED', 'A worker is currently reconciling this event.');
      await db.query(
        'UPDATE seven.provider_events SET attempts=0,lease_id=NULL,lease_expires_at=NULL,next_attempt_at=now() WHERE provider_event_id=$1',
        [id(req)],
      );
      await S.audit(
        db,
        actor,
        null,
        'provider_event.manual_retry',
        id(req),
        `Previous attempts: ${event.attempts}. ${input.reason}`,
      );
      return { success: true };
    });
  });

  mountOperations(app, { pool, actor: actorFor, mutate });
  mountAdminRecords(app, { pool, actor: actorFor });
  const sendRecovery = options.sendRecovery ?? configuredRecoveryMailer();
  mountAccountRoutes(app, {
    pool,
    environment,
    publicOrigin,
    ...(sendRecovery ? { sendRecovery } : {}),
  });
  app.use('/api', (_req, _res, next) =>
    next(new ApiError(404, 'NOT_FOUND', 'This API route was not found.')),
  );
  const webDirectory = fileURLToPath(new URL('../../../apps/web/dist/', import.meta.url));
  if (existsSync(`${webDirectory}/index.html`)) {
    app.use(
      express.static(webDirectory, {
        index: false,
        maxAge: environment === 'production' ? '1h' : 0,
      }),
    );
    app.get('/{*route}', (_req, res) => {
      res.sendFile(`${webDirectory}/index.html`);
    });
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    if (error instanceof z.ZodError) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Check the details and try again.',
          fields: z.flattenError(error).fieldErrors,
          requestId: res.locals.requestId,
        },
      });
      return;
    }
    if (error instanceof RangeError) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          requestId: res.locals.requestId,
        },
      });
      return;
    }
    if (error instanceof ApiError) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message, requestId: res.locals.requestId },
      });
      return;
    }
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === '23505' || code === '40001' || code === '40P01') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'This record changed. Refresh and retry the action.',
          requestId: res.locals.requestId,
        },
      });
      return;
    }
    console.error(
      '7even request failed',
      res.locals.requestId,
      error instanceof Error ? error.message : 'Unknown error',
    );
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The request could not be completed. Please try again.',
        requestId: res.locals.requestId,
      },
    });
  });
  return { app, pool, provider };
}
