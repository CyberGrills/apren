import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import type { SessionUser } from '@7even/contracts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fail, one, rows } from './db.ts';

interface Context { pool: Pool; actor: (res: Response) => SessionUser; }
const inputSchema = z.strictObject({
  offeringId: z.uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roomCount: z.number().int().min(1).max(20),
  guestName: z.string().trim().min(2).max(100),
  guestEmail: z.email().max(254).transform(v => v.trim().toLowerCase()),
  guestPhone: z.string().trim().min(7).max(30),
  guestMessage: z.string().trim().max(1000).default(''),
});
const actionSchema = z.strictObject({
  action: z.enum(['ACCEPT','DECLINE']),
  expectedRevision: z.number().int().min(1),
  response: z.string().trim().max(1000).default(''),
});
function customer(actor: SessionUser) {
  if (actor.role !== 'CUSTOMER') return fail(403,'CUSTOMER_REQUIRED','A customer account is required to submit a stay request.');
}
function owner(actor: SessionUser) {
  if (actor.role !== 'BUSINESS_OWNER' || !actor.businessId)
    return fail(403,'BUSINESS_OWNER_REQUIRED','Business owner access is required.');
}
function project(r: Record<string, unknown>) {
  return {
    id: String(r.request_id), reference: String(r.request_reference),
    offeringId: String(r.offering_id), businessId: String(r.business_id),
    property: String(r.title), city: String(r.city),
    checkIn: String(r.check_in).slice(0,10), checkOut: String(r.check_out).slice(0,10),
    roomCount: Number(r.room_count), guestName: String(r.guest_name),
    guestEmail: String(r.guest_email), guestPhone: String(r.guest_phone),
    guestMessage: String(r.guest_message), quotedRateMinor: r.quoted_rate_minor == null ? null : String(r.quoted_rate_minor),
    currency: 'NGN', status: String(r.status), paymentStatus: 'UNPAID',
    propertyResponse: String(r.property_response), revision: Number(r.revision),
    expiresAt: new Date(String(r.expires_at)).toISOString(), createdAt: new Date(String(r.created_at)).toISOString(),
    respondedAt: r.responded_at ? new Date(String(r.responded_at)).toISOString() : null,
  };
}
const select = `SELECT r.*,o.title,o.city FROM seven.stay_booking_requests r
 JOIN seven.offerings o USING(offering_id)`;
export function mountStayBookingRequests(app: Express, { pool, actor }: Context): void {
  app.post('/api/stay-booking-requests', async (req,res) => {
    const user = actor(res); customer(user);
    const input = inputSchema.parse(req.body);
    if (input.checkOut <= input.checkIn) return fail(422,'INVALID_STAY_DATES','Check-out must be after check-in.');
    const key = String(req.get('Idempotency-Key') ?? '').trim();
    if (key.length < 8 || key.length > 200) return fail(400,'IDEMPOTENCY_KEY_REQUIRED','Provide a valid Idempotency-Key.');
    const existing = await one(pool,select+' WHERE r.user_id=$1 AND r.idempotency_key=$2',[user.id,key]);
    if (existing) {
      if (existing.offering_id !== input.offeringId || String(existing.check_in).slice(0,10) !== input.checkIn || String(existing.check_out).slice(0,10) !== input.checkOut || Number(existing.room_count) !== input.roomCount)
        return fail(409,'IDEMPOTENCY_CONFLICT','This request key was already used for different booking details.');
      return res.json({data:project(existing)});
    }
    const offer = await one(pool,`SELECT o.offering_id,o.title,o.city,o.price_minor,o.is_published,s.sector_code,
      b.business_id,bs.workflow_state_code AS business_status,b.details
      FROM seven.offerings o JOIN seven.sectors s USING(sector_id)
      JOIN seven.businesses b USING(business_id)
      JOIN seven.workflow_states bs ON bs.workflow_state_id=b.workflow_state_id
      WHERE o.offering_id=$1`,[input.offeringId]);
    if (!offer || offer.sector_code !== 'STAY' || !offer.is_published || offer.business_status !== 'APPROVED' || offer.details?.isSample === true)
      return fail(404,'PROPERTY_NOT_REQUESTABLE','This property is not accepting booking requests.');
    const requestId = randomUUID();
    const reference = '7R'+randomUUID().replace(/-/g,'').slice(0,12).toUpperCase();
    const created = await one(pool,`INSERT INTO seven.stay_booking_requests
      (request_id,request_reference,user_id,business_id,offering_id,check_in,check_out,room_count,guest_name,guest_email,guest_phone,guest_message,quoted_rate_minor,idempotency_key)
      VALUES($1,$2,$3,$4,$5,$6::date,$7::date,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT(user_id,idempotency_key) DO NOTHING RETURNING request_id`,
      [requestId,reference,user.id,offer.business_id,input.offeringId,input.checkIn,input.checkOut,input.roomCount,input.guestName,input.guestEmail,input.guestPhone,input.guestMessage,offer.price_minor,key]);
    if (!created) {
      const prior = await one(pool,select+' WHERE r.user_id=$1 AND r.idempotency_key=$2',[user.id,key]);
      if (!prior) return fail(409,'REQUEST_CONFLICT','Refresh and retry your booking request.');
      if (prior.offering_id !== input.offeringId) return fail(409,'IDEMPOTENCY_CONFLICT','This request key was already used for different booking details.');
      return res.json({data:project(prior)});
    }
    await pool.query(`INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details)
      VALUES($1,$2,$3,'stay_booking_request.created',$4,$5)`,
      [randomUUID(),user.id,offer.business_id,requestId,{reference}]);
    const result = await one(pool,select+' WHERE r.request_id=$1',[requestId]);
    return res.status(201).json({data:project(result!)});
  });
  app.get('/api/business/stay-booking-requests', async (_req,res) => {
    const user = actor(res); owner(user);
    const found = await rows(pool,select+' WHERE r.business_id=$1 ORDER BY r.created_at DESC LIMIT 200',[user.businessId]);
    return res.json({data:found.map(project)});
  });
  app.post('/api/business/stay-booking-requests/:id/actions', async (req,res) => {
    const user = actor(res); owner(user);
    const id = z.uuid().parse(req.params.id); const input = actionSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const request = await one(client,'SELECT * FROM seven.stay_booking_requests WHERE request_id=$1 AND business_id=$2 FOR UPDATE',[id,user.businessId]);
      if (!request) { await client.query('ROLLBACK'); return fail(404,'REQUEST_NOT_FOUND','Booking request not found.'); }
      if (Number(request.revision) !== input.expectedRevision) { await client.query('ROLLBACK'); return fail(409,'REVISION_CONFLICT','This request changed. Refresh before responding.'); }
      if (request.status !== 'REQUESTED') { await client.query('ROLLBACK'); return fail(409,'REQUEST_NOT_ACTIONABLE','This booking request is no longer awaiting a response.'); }
      if (new Date(String(request.expires_at)) <= new Date()) {
        await client.query("UPDATE seven.stay_booking_requests SET status='EXPIRED',revision=revision+1,updated_at=now() WHERE request_id=$1",[id]);
        await client.query('COMMIT');
        return fail(409,'REQUEST_EXPIRED','This booking request has expired.');
      }
      const status = input.action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
      await client.query(`UPDATE seven.stay_booking_requests SET status=$2,property_response=$3,responded_by=$4,responded_at=now(),revision=revision+1,updated_at=now() WHERE request_id=$1`,
        [id,status,input.response,user.id]);
      await client.query(`INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details)
        VALUES($1,$2,$3,$4,$5,$6)`,
        [randomUUID(),user.id,user.businessId,'stay_booking_request.'+status.toLowerCase(),id,{response:input.response}]);
      await client.query('COMMIT');
      const updated = await one(pool,select+' WHERE r.request_id=$1',[id]);
      return res.json({data:project(updated!)});
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  app.get('/api/me/stay-booking-requests', async (_req,res) => {
    const user = actor(res); customer(user);
    const found = await rows(pool,select+' WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 100',[user.id]);
    return res.json({data:found.map(project)});
  });
}
