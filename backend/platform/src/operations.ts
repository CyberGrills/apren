import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import * as C from '@7even/contracts';
import { one, rows, fail } from './db.ts';
import type { Connection } from './db.ts';
import * as S from './store.ts';
import { reservationAccess } from './reservations.ts';

interface OperationsContext {
  pool: Pool;
  actor: (res: Response) => C.SessionUser;
  mutate: <T>(
    req: Request,
    res: Response,
    work: (db: Connection, actor: C.SessionUser) => Promise<T>,
  ) => Promise<T>;
}
export function mountOperations(app: Express, context: OperationsContext): void {
  const { pool, actor, mutate } = context;
  const role = (user: C.SessionUser, roles: C.Role[]) => {
    if (!roles.includes(user.role))
      fail(403, 'FORBIDDEN', 'This account cannot perform that action.');
  };
  const owner = (res: Response) => {
    const user = actor(res);
    role(user, ['BUSINESS_OWNER']);
    if (!user.businessId)
      return fail(403, 'BUSINESS_REQUIRED', 'An active owner membership is required.');
    return user;
  };
  const route = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    work: (req: Request, res: Response) => Promise<unknown>,
  ) => app[method](`/api${path}`, async (req, res) => res.json({ data: await work(req, res) }));
  const venueProjection = (r: Record<string, unknown>): C.Venue => ({
    id: String(r.venue_id),
    businessId: String(r.business_id),
    venueName: String(r.venue_name),
    address: String(r.address_line),
    city: String(r.city),
    timeZone: 'Africa/Lagos',
    revision: Number(r.revision),
  });
  route('get', '/business/venues', async (_req, res) => {
    const user = owner(res);
    return (
      await rows(
        pool,
        'SELECT * FROM seven.venues WHERE business_id=$1 AND is_active ORDER BY created_at',
        [user.businessId],
      )
    ).map(venueProjection);
  });
  route('post', '/business/venues', async (req, res) => {
    const input = C.venueInput.parse(req.body);
    owner(res);
    return mutate(req, res, async (db, user) => {
      const venueId = randomUUID();
      const venue = (await one(
        db,
        'INSERT INTO seven.venues(venue_id,business_id,venue_name,address_line,city,timezone_name) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [venueId, user.businessId, input.venueName, input.address, input.city, input.timeZone],
      ))!;
      await S.audit(db, user, user.businessId, 'venue.created', venueId);
      return venueProjection(venue);
    });
  });
  route('patch', '/business/venues/:id', async (req, res) => {
    const input = C.venueInput.extend({ expectedRevision: z.int().min(1) }).parse(req.body);
    owner(res);
    const venueId = z.uuid().parse(req.params.id);
    return mutate(req, res, async (db, user) => {
      const venue = await one(
        db,
        'SELECT * FROM seven.venues WHERE venue_id=$1 AND is_active FOR UPDATE',
        [venueId],
      );
      if (!venue) return fail(404, 'NOT_FOUND', 'Venue not found.');
      S.requireTenant(user, venue.business_id, true);
      if (venue.revision !== input.expectedRevision)
        return fail(409, 'REVISION_CONFLICT', 'This venue changed. Refresh before editing.');
      const updated = (await one(
        db,
        'UPDATE seven.venues SET venue_name=$2,address_line=$3,city=$4,timezone_name=$5,revision=revision+1,updated_at=now() WHERE venue_id=$1 RETURNING *',
        [venueId, input.venueName, input.address, input.city, input.timeZone],
      ))!;
      await S.audit(db, user, user.businessId, 'venue.updated', venueId);
      return venueProjection(updated);
    });
  });
  route('delete', '/business/venues/:id', async (req, res) => {
    owner(res);
    const venueId = z.uuid().parse(req.params.id);
    return mutate(req, res, async (db, user) => {
      const venue = await one(
        db,
        'SELECT * FROM seven.venues WHERE venue_id=$1 AND is_active FOR UPDATE',
        [venueId],
      );
      if (!venue) return fail(404, 'NOT_FOUND', 'Venue not found.');
      S.requireTenant(user, venue.business_id, true);
      if (
        (await one(db, 'SELECT offering_id FROM seven.offerings WHERE venue_id=$1 LIMIT 1', [
          venueId,
        ])) ||
        (await one(
          db,
          'SELECT membership_id FROM seven.memberships WHERE venue_id=$1 AND is_active LIMIT 1',
          [venueId],
        ))
      )
        return fail(
          409,
          'VENUE_IN_USE',
          'This venue has retained offerings and cannot be archived.',
        );
      await db.query(
        'UPDATE seven.venues SET is_active=false,revision=revision+1,updated_at=now() WHERE venue_id=$1',
        [venueId],
      );
      await S.audit(db, user, user.businessId, 'venue.archived', venueId);
      return { success: true };
    });
  });
  const noteProjection = (r: Record<string, unknown>): C.PaymentNote => ({
    id: String(r.payment_note_id),
    reservationId: String(r.reservation_id),
    amountMinor: String(r.amount_minor),
    currency: 'NGN',
    method: r.method_code as C.PaymentNote['method'],
    reference: String(r.payment_reference),
    note: String(r.note_body),
    recordedBy: String(r.display_name),
    recordedAt: S.iso(r.created_at as Date),
  });
  async function notesAccess(db: Connection, user: C.SessionUser, reservationId: string) {
    role(user, ['BUSINESS_OWNER', 'RECEPTION', 'ADMIN']);
    const reservation = await S.reservationProjection(db, reservationId);
    if (!reservation) return fail(404, 'NOT_FOUND', 'Reservation not found.');
    await reservationAccess(db, user, reservation);
    return reservation;
  }
  route('get', '/reception/reservations/:id/payment-notes', async (req, res) => {
    const reservationId = z.uuid().parse(req.params.id);
    await notesAccess(pool, actor(res), reservationId);
    return (
      await rows(
        pool,
        'SELECT p.*,m.method_code,u.display_name FROM seven.payment_notes p JOIN seven.payment_note_methods m USING(payment_note_method_id) JOIN seven.users u USING(user_id) WHERE reservation_id=$1 ORDER BY p.created_at',
        [reservationId],
      )
    ).map(noteProjection);
  });
  route('post', '/reception/reservations/:id/payment-notes', async (req, res) => {
    const input = C.paymentNoteInput.parse(req.body);
    const reservationId = z.uuid().parse(req.params.id);
    await notesAccess(pool, actor(res), reservationId);
    return mutate(req, res, async (db, user) => {
      const reservation = await notesAccess(db, user, reservationId);
      if (BigInt(input.amountMinor) > BigInt(reservation.price.totalMinor))
        return fail(
          422,
          'NOTE_AMOUNT_TOO_LARGE',
          'The note amount cannot exceed this reservation total.',
        );
      const noteId = randomUUID();
      await db.query(
        'INSERT INTO seven.payment_notes(payment_note_id,reservation_id,user_id,payment_note_method_id,amount_minor,payment_reference,note_body) VALUES($1,$2,$3,(SELECT payment_note_method_id FROM seven.payment_note_methods WHERE method_code=$4),$5,$6,$7)',
        [
          noteId,
          reservationId,
          user.id,
          input.method,
          input.amountMinor,
          input.reference ?? '',
          input.note ?? '',
        ],
      );
      await S.audit(
        db,
        user,
        reservation.businessId,
        'reception.external_payment_note',
        reservationId,
        'Staff note only. Provider payment and reward eligibility are unchanged.',
      );
      const record = (await one(
        db,
        'SELECT p.*,m.method_code,u.display_name FROM seven.payment_notes p JOIN seven.payment_note_methods m USING(payment_note_method_id) JOIN seven.users u USING(user_id) WHERE payment_note_id=$1',
        [noteId],
      ))!;
      return noteProjection(record);
    });
  });
  route('get', '/admin/operations', async (_req, res): Promise<C.AdminOperations> => {
    role(actor(res), ['ADMIN']);
    const count = async (sql: string) => Number((await one(pool, sql))?.total ?? 0);
    const sourceRows = await rows(
      pool,
      'SELECT s.*,b.business_name,u.display_name,(SELECT max(created_at) FROM seven.sync_events e WHERE e.device_id=s.source_id::varchar) AS last_synced_at,(SELECT count(*) FROM seven.sync_events e WHERE e.device_id=s.source_id::varchar) AS event_count FROM seven.sources s JOIN seven.businesses b USING(business_id) JOIN seven.users u USING(user_id) ORDER BY s.created_at',
    );
    const rewardIds = await rows(
      pool,
      'SELECT reward_id FROM seven.rewards ORDER BY created_at DESC LIMIT 200',
    );
    return {
      health: {
        pendingInbox: await count(
          'SELECT count(*) AS total FROM seven.provider_events WHERE processed_at IS NULL AND attempts<5',
        ),
        failedInbox: await count(
          'SELECT count(*) AS total FROM seven.provider_events WHERE processed_at IS NULL AND attempts>=5',
        ),
        pendingOutbox: await count(
          'SELECT count(*) AS total FROM seven.outbox_events WHERE processed_at IS NULL AND attempts<5',
        ),
        failedOutbox: await count(
          'SELECT count(*) AS total FROM seven.outbox_events WHERE processed_at IS NULL AND attempts>=5',
        ),
        unknownPayments: await count(
          `SELECT count(*) AS total FROM seven.payment_attempts WHERE workflow_state_id=${S.sid('UNKNOWN')}`,
        ),
        pendingRefunds: await count(
          `SELECT count(*) AS total FROM seven.refunds WHERE workflow_state_id<>${S.sid('DELIVERED')}`,
        ),
        syncConflicts: await count(
          "SELECT count(*) AS total FROM seven.sync_events WHERE result_body->>'status' IN ('CONFLICT','REJECTED')",
        ),
        checkedAt: new Date().toISOString(),
      },
      sources: sourceRows.map((s) => ({
        id: s.source_id,
        businessId: s.business_id,
        businessName: s.business_name,
        userId: s.user_id,
        displayName: s.display_name,
        isActive: s.is_active,
        lastSyncedAt: s.last_synced_at ? S.iso(s.last_synced_at) : null,
        eventCount: Number(s.event_count),
      })),
      rewards: (
        await Promise.all(rewardIds.map((r) => S.rewardProjection(pool, r.reward_id)))
      ).filter((r): r is C.Reward => !!r),
    };
  });
  route('post', '/admin/sources/:id/status', async (req, res) => {
    role(actor(res), ['ADMIN']);
    const input = C.sourceStatusInput.parse(req.body);
    const sourceId = z.uuid().parse(req.params.id);
    return mutate(req, res, async (db, user) => {
      role(user, ['ADMIN']);
      const source = await one(
        db,
        'SELECT s.*,m.is_active AS member_active,u.is_active AS user_active FROM seven.sources s JOIN seven.memberships m ON m.user_id=s.user_id AND m.business_id=s.business_id JOIN seven.users u ON u.user_id=s.user_id WHERE source_id=$1 FOR UPDATE OF s',
        [sourceId],
      );
      if (!source) return fail(404, 'NOT_FOUND', 'Reception source not found.');
      if (input.active && (!source.member_active || !source.user_active))
        return fail(
          409,
          'MEMBERSHIP_REVOKED',
          'Restore the authorized membership before activating this source.',
        );
      await db.query('UPDATE seven.sources SET is_active=$2,updated_at=now() WHERE source_id=$1', [
        sourceId,
        input.active,
      ]);
      await S.audit(
        db,
        user,
        source.business_id,
        input.active ? 'source.activated' : 'source.paused',
        sourceId,
        input.reason,
      );
      return { success: true };
    });
  });
  route('post', '/admin/rewards/:id/moderation', async (req, res) => {
    role(actor(res), ['ADMIN']);
    const input = C.rewardModerationInput.parse(req.body);
    const rewardId = z.uuid().parse(req.params.id);
    return mutate(req, res, async (db, user) => {
      role(user, ['ADMIN']);
      const reward = await S.rewardProjection(db, rewardId);
      if (!reward) return fail(404, 'NOT_FOUND', 'Reward not found.');
      const business = await S.businessProjection(db, reward.businessId);
      if (input.published && business?.status !== 'APPROVED')
        return fail(409, 'BUSINESS_UNAVAILABLE', 'Only approved businesses may publish rewards.');
      await db.query(
        'UPDATE seven.rewards SET is_published=$2,revision=revision+1,updated_at=now() WHERE reward_id=$1',
        [rewardId, input.published],
      );
      await S.audit(db, user, reward.businessId, 'reward.moderated', rewardId, input.reason);
      return S.rewardProjection(db, rewardId);
    });
  });
}
