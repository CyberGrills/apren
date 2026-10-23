import { randomUUID } from 'node:crypto';
import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import * as C from '@7even/contracts';
import { one, rows, fail } from './db.ts';

const eventSchema = z.strictObject({
  eventId: z.uuid(),
  sessionId: z.uuid(),
  offeringId: z.uuid(),
  event: z.enum([
    'SEARCH',
    'ROOM_VIEW',
    'BOOKING_START',
    'CHECKOUT_VIEW',
    'ABANDON',
    'PAYMENT_FAILED',
  ]),
  reason: z.enum(['PRICE', 'DATES', 'POLICY', 'PAYMENT', 'QUESTION', 'UNKNOWN']).nullable().optional(),
  amountMinor: z.string().regex(/^(0|[1-9]\d{0,14})$/).nullable().optional(),
  occurredAt: z.iso.datetime({ offset: true }),
  contactChannel: z.enum(['NONE', 'WHATSAPP', 'EMAIL']).default('NONE'),
  contactConsent: z.boolean().default(false),
  consentTextVersion: z.string().trim().min(1).max(80).nullable().optional(),
});

type RecoveryActor = (res: Response) => C.SessionUser;

interface RecoveryContext {
  pool: Pool;
  actor: RecoveryActor;
}

export function mountBookingRecovery(app: Express, context: RecoveryContext): void {
  const { pool, actor } = context;

  app.post('/api/recovery/events', async (req, res) => {
    const input = eventSchema.parse(req.body);
    if (input.contactConsent) {
      if (input.contactChannel === 'NONE' || !input.consentTextVersion)
        return fail(422, 'CONSENT_EVIDENCE_REQUIRED', 'A channel and consent text version are required.');
    } else if (input.contactChannel !== 'NONE' || input.consentTextVersion) {
      return fail(422, 'CONSENT_MISMATCH', 'Do not record a contact channel without explicit consent.');
    }

    const occurredAt = new Date(input.occurredAt);
    const now = Date.now();
    if (occurredAt.getTime() > now + 5 * 60_000 || occurredAt.getTime() < now - 30 * 24 * 60 * 60_000)
      return fail(422, 'EVENT_TIME_OUT_OF_RANGE', 'Event time must be within the last 30 days.');

    const offering = await one(
      pool,
      `SELECT o.offering_id
       FROM seven.offerings o
       JOIN seven.sectors s USING(sector_id)
       JOIN seven.businesses b USING(business_id)
       JOIN seven.workflow_states ws USING(workflow_state_id)
       WHERE o.offering_id=$1
         AND s.sector_code='STAY'
         AND o.is_published
         AND ws.workflow_state_code='APPROVED'`,
      [input.offeringId],
    );
    if (!offering) return fail(404, 'OFFER_NOT_TRACKABLE', 'This hotel offering is not currently eligible for recovery tracking.');

    const inserted = await one(
      pool,
      `INSERT INTO seven.booking_recovery_events(
         recovery_event_id,event_id,session_id,offering_id,event_code,reason_code,
         amount_minor,contact_channel,contact_consent,consent_text_version,occurred_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT(event_id) DO NOTHING
       RETURNING recovery_event_id`,
      [
        randomUUID(),
        input.eventId,
        input.sessionId,
        input.offeringId,
        input.event,
        input.reason ?? null,
        input.amountMinor ?? null,
        input.contactConsent ? input.contactChannel : 'NONE',
        input.contactConsent,
        input.contactConsent ? input.consentTextVersion : null,
        occurredAt.toISOString(),
      ],
    );
    res.status(inserted ? 202 : 200).json({ data: { accepted: true, duplicate: !inserted } });
  });

  app.get('/api/business/recovery/summary', async (_req, res) => {
    const user = actor(res);
    if (user.role !== 'BUSINESS_OWNER' || !user.businessId)
      return fail(403, 'BUSINESS_REQUIRED', 'An active business owner membership is required.');

    const summary = await one(
      pool,
      `WITH session_facts AS (
         SELECT e.session_id,e.offering_id,
           bool_or(e.event_code='ABANDON') AS abandoned,
           bool_or(e.event_code='BOOKING_CONFIRMED' AND e.occurred_at >
             COALESCE((SELECT min(a.occurred_at) FROM seven.booking_recovery_events a
                       WHERE a.session_id=e.session_id AND a.offering_id=e.offering_id
                         AND a.event_code='ABANDON'), 'infinity'::timestamptz)) AS recovered_after_abandon,
           bool_or(e.event_code='ABANDON' AND e.contact_consent) AS consented_abandon
         FROM seven.booking_recovery_events e
         JOIN seven.offerings o USING(offering_id)
         WHERE o.business_id=$1
         GROUP BY e.session_id,e.offering_id
       )
       SELECT count(*) FILTER (WHERE abandoned)::int AS abandoned_sessions,
         count(*) FILTER (WHERE abandoned AND consented_abandon)::int AS consented_abandons,
         count(*) FILTER (WHERE abandoned AND recovered_after_abandon)::int AS confirmed_after_abandon,
         count(*) FILTER (WHERE abandoned AND NOT recovered_after_abandon)::int AS unresolved_abandons
       FROM session_facts`,
      [user.businessId],
    );
    const reasons = await rows(
      pool,
      `SELECT e.reason_code AS reason,count(DISTINCT e.session_id)::int AS sessions
       FROM seven.booking_recovery_events e
       JOIN seven.offerings o USING(offering_id)
       WHERE o.business_id=$1 AND e.event_code='ABANDON'
       GROUP BY e.reason_code ORDER BY sessions DESC,reason NULLS LAST`,
      [user.businessId],
    );
    res.json({ data: { ...(summary ?? {}), reasons } });
  });
}
