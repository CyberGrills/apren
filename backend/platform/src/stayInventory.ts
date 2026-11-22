import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import type { SessionUser } from '@7even/contracts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fail, one, rows } from './db.ts';
import type { Connection } from './db.ts';
import * as S from './store.ts';

type Work = (db: Connection, actor: SessionUser) => Promise<unknown>;
interface Context {
  pool: Pool;
  actor: (res: Response) => SessionUser;
  mutate: (req: Request, res: Response, work: Work) => Promise<unknown>;
}
const uuid = z.uuid();
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const roomInput = z.strictObject({
  offeringId: uuid,
  maxOccupancy: z.number().int().min(1).max(30),
  bedConfiguration: z.string().trim().max(180).default(''),
  totalRooms: z.number().int().min(1).max(10000).nullable().optional(),
  expectedRevision: z.number().int().min(1).optional(),
});
const ratePlanInput = z.strictObject({
  roomTypeId: uuid,
  code: z.string().trim().regex(/^[A-Z0-9_-]{2,40}$/),
  name: z.string().trim().min(2).max(120),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).default('NGN'),
  mealPlan: z.string().trim().min(2).max(40).default('ROOM_ONLY'),
  refundable: z.boolean().nullable().optional(),
  cancellationPolicy: z.string().trim().max(4000).default(''),
  expectedRevision: z.number().int().min(1).optional(),
});
const nightlyInput = z.strictObject({
  ratePlanId: uuid,
  startDate: localDate,
  endDate: localDate,
  amountMinor: z.string().regex(/^(0|[1-9]\d{0,14})$/),
  closedToArrival: z.boolean().default(false),
  closedToDeparture: z.boolean().default(false),
  minStayNights: z.number().int().min(1).max(365).nullable().optional(),
  maxStayNights: z.number().int().min(1).max(365).nullable().optional(),
  expectedRevision: z.number().int().min(0).optional(),
});
function ownerBusiness(actor: SessionUser): string {
  if (actor.role !== 'BUSINESS_OWNER' || !actor.businessId)
    return fail(403, 'BUSINESS_OWNER_REQUIRED', 'Business owner access is required.');
  return actor.businessId;
}
function dateRange(start: string, end: string): string[] {
  const first = Date.parse(start + 'T00:00:00Z');
  const last = Date.parse(end + 'T00:00:00Z');
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first)
    return fail(422, 'INVALID_DATE_RANGE', 'Choose a valid date range.');
  const days = Math.floor((last - first) / 86400000) + 1;
  if (days > 366) return fail(422, 'DATE_RANGE_TOO_LARGE', 'Update no more than 366 nights at a time.');
  return Array.from({ length: days }, (_, index) => new Date(first + index * 86400000).toISOString().slice(0, 10));
}
export function mountStayInventory(app: Express, { pool, actor, mutate }: Context): void {
  function write(req: Request, res: Response, mutate: Context['mutate'], work: Work) { return mutate(req,res,work).then(data => { if (!res.headersSent) res.json({ data }); }); }

  app.get('/api/business/stay/calendar', async (req, res) => {
    const user = actor(res);
    if (!['BUSINESS_OWNER', 'RECEPTION'].includes(user.role) || !user.businessId)
      return fail(403, 'FORBIDDEN', 'Business access is required.');
    const start = localDate.parse(req.query.startDate);
    const end = localDate.parse(req.query.endDate);
    const dates = dateRange(start, end);
    const offeringId = req.query.offeringId ? uuid.parse(req.query.offeringId) : null;
    const params: unknown[] = [user.businessId, start, end];
    const offeringFilter = offeringId ? 'AND o.offering_id=$4' : '';
    if (offeringId) params.push(offeringId);
    const venueFilter = user.role === 'RECEPTION' ? 'AND o.venue_id=ANY($' + (params.push(user.venueIds), params.length) + '::uuid[])' : '';
    const records = await rows(pool,
      `SELECT rt.room_type_id,rt.offering_id,rt.max_occupancy,rt.bed_configuration,rt.total_rooms,rt.is_active AS room_active,rt.revision AS room_revision,
              o.title,o.venue_id,v.timezone_name,
              rp.rate_plan_id,rp.code AS rate_plan_code,rp.name AS rate_plan_name,rp.currency_code,rp.is_active AS rate_plan_active,
              nr.service_date,nr.amount_minor::text AS amount_minor,nr.closed_to_arrival,nr.closed_to_departure,nr.min_stay_nights,nr.max_stay_nights,nr.revision AS rate_revision,
              iw.capacity,iw.allocated_count,iw.revision AS inventory_revision,iw.inventory_confirmed_at,iw.inventory_source,iw.starts_at
         FROM seven.stay_room_types rt
         JOIN seven.offerings o USING(offering_id)
         JOIN seven.venues v USING(venue_id)
         LEFT JOIN seven.stay_rate_plans rp ON rp.room_type_id=rt.room_type_id AND rp.is_active
         LEFT JOIN seven.stay_nightly_rates nr ON nr.rate_plan_id=rp.rate_plan_id AND nr.service_date BETWEEN $2::date AND $3::date
         LEFT JOIN seven.inventory_windows iw ON iw.offering_id=o.offering_id
           AND iw.starts_at=((nr.service_date::timestamp AT TIME ZONE COALESCE(v.timezone_name,'Africa/Lagos')))
        WHERE o.business_id=$1
          ${offeringFilter} ${venueFilter}
        ORDER BY o.title,rp.name,nr.service_date`,
      params);
    return res.json({ data: { dates, rooms: records } });
  });

  app.post('/api/business/stay/rooms', async (req, res) => mutate(req, res, async (db, user) => {
    const businessId = ownerBusiness(user);
    const input = roomInput.parse(req.body);
    const offer = await one(db,
      `SELECT o.offering_id,o.business_id,o.venue_id,s.sector_code
         FROM seven.offerings o JOIN seven.sectors s USING(sector_id)
        WHERE o.offering_id=$1 AND o.business_id=$2 FOR UPDATE OF o`,
      [input.offeringId, businessId]);
    if (!offer) return fail(404, 'OFFERING_NOT_FOUND', 'Stay listing not found.');
    if (offer.sector_code !== 'STAY') return fail(422, 'STAY_ONLY', 'Room categories can only be added to a stay listing.');
    const existing = await one(db, 'SELECT * FROM seven.stay_room_types WHERE offering_id=$1 FOR UPDATE', [input.offeringId]);
    if (existing) {
      if (input.expectedRevision === undefined || input.expectedRevision !== existing.revision)
        return fail(409, 'REVISION_CONFLICT', 'Refresh this room category before editing.');
      await db.query(
        'UPDATE seven.stay_room_types SET max_occupancy=$2,bed_configuration=$3,total_rooms=$4,revision=revision+1,updated_at=now() WHERE room_type_id=$1',
        [existing.room_type_id,input.maxOccupancy,input.bedConfiguration,input.totalRooms ?? null]);
      await S.audit(db,user,businessId,'stay_room_type.updated',existing.room_type_id,'Room configuration updated.');
      return one(db,'SELECT * FROM seven.stay_room_types WHERE room_type_id=$1',[existing.room_type_id]);
    }
    const roomTypeId=randomUUID();
    await db.query(
      'INSERT INTO seven.stay_room_types(room_type_id,offering_id,max_occupancy,bed_configuration,total_rooms) VALUES($1,$2,$3,$4,$5)',
      [roomTypeId,input.offeringId,input.maxOccupancy,input.bedConfiguration,input.totalRooms ?? null]);
    await S.audit(db,user,businessId,'stay_room_type.created',roomTypeId,'Room configuration created.');
    return one(db,'SELECT * FROM seven.stay_room_types WHERE room_type_id=$1',[roomTypeId]);
  }));

  app.patch('/api/business/stay/rooms/:id', async (req, res) => mutate(req, res, async (db,user) => {
    const businessId=ownerBusiness(user); const roomId=uuid.parse(req.params.id);
    const input=roomInput.omit({offeringId:true}).extend({isActive:z.boolean().optional()}).parse(req.body);
    const room=await one(db,
      `SELECT rt.* FROM seven.stay_room_types rt JOIN seven.offerings o USING(offering_id)
        WHERE rt.room_type_id=$1 AND o.business_id=$2 FOR UPDATE OF rt`,[roomId,businessId]);
    if(!room) return fail(404,'ROOM_TYPE_NOT_FOUND','Room category not found.');
    if(input.expectedRevision!==room.revision) return fail(409,'REVISION_CONFLICT','Refresh this room category before editing.');
    await db.query(
      'UPDATE seven.stay_room_types SET max_occupancy=$2,bed_configuration=$3,total_rooms=$4,is_active=$5,revision=revision+1,updated_at=now() WHERE room_type_id=$1',
      [roomId,input.maxOccupancy,input.bedConfiguration,input.totalRooms ?? null,input.isActive ?? room.is_active]);
    await S.audit(db,user,businessId,'stay_room_type.updated',roomId,'Room configuration updated.');
    return one(db,'SELECT * FROM seven.stay_room_types WHERE room_type_id=$1',[roomId]);
  }));

  app.post('/api/business/stay/rate-plans', async (req,res)=>write(req,res,mutate,async(db,user)=>{
    const businessId=ownerBusiness(user); const input=ratePlanInput.parse(req.body);
    const room=await one(db,
      `SELECT rt.room_type_id,o.business_id FROM seven.stay_room_types rt JOIN seven.offerings o USING(offering_id)
        WHERE rt.room_type_id=$1 AND o.business_id=$2 AND rt.is_active FOR UPDATE OF rt`,
      [input.roomTypeId,businessId]);
    if(!room) return fail(404,'ROOM_TYPE_NOT_FOUND','Active room category not found.');
    if(input.expectedRevision!==undefined) return fail(422,'UNEXPECTED_REVISION','Do not provide a revision when creating a rate plan.');
    const planId=randomUUID();
    await db.query(
      'INSERT INTO seven.stay_rate_plans(rate_plan_id,room_type_id,offering_id,code,name,currency_code,meal_plan,refundable,cancellation_policy) SELECT $1,rt.room_type_id,o.offering_id,$3,$4,$5,$6,$7,$8 FROM seven.stay_room_types rt JOIN seven.offerings o USING(offering_id) WHERE rt.room_type_id=$2',
      [planId,input.roomTypeId,input.code,input.name,input.currencyCode,input.mealPlan,input.refundable ?? null,input.cancellationPolicy]);
    await S.audit(db,user,businessId,'stay_rate_plan.created',planId,'Rate plan created.');
    return one(db,'SELECT * FROM seven.stay_rate_plans WHERE rate_plan_id=$1',[planId]);
  }));

  app.patch('/api/business/stay/rate-plans/:id', async(req,res)=>mutate(req,res,async(db,user)=>{
    const businessId=ownerBusiness(user); const planId=uuid.parse(req.params.id);
    const input=ratePlanInput.omit({roomTypeId:true}).extend({isActive:z.boolean().optional()}).parse(req.body);
    const plan=await one(db,
      `SELECT rp.* FROM seven.stay_rate_plans rp JOIN seven.stay_room_types rt USING(room_type_id)
        JOIN seven.offerings o USING(offering_id) WHERE rp.rate_plan_id=$1 AND o.business_id=$2 FOR UPDATE OF rp`,
      [planId,businessId]);
    if(!plan) return fail(404,'RATE_PLAN_NOT_FOUND','Rate plan not found.');
    if(input.expectedRevision!==plan.revision) return fail(409,'REVISION_CONFLICT','Refresh this rate plan before editing.');
    await db.query(
      'UPDATE seven.stay_rate_plans SET code=$2,name=$3,currency_code=$4,meal_plan=$5,refundable=$6,cancellation_policy=$7,is_active=$8,revision=revision+1,updated_at=now() WHERE rate_plan_id=$1',
      [planId,input.code,input.name,input.currencyCode,input.mealPlan,input.refundable ?? null,input.cancellationPolicy,input.isActive ?? plan.is_active]);
    await S.audit(db,user,businessId,'stay_rate_plan.updated',planId,'Rate plan updated.');
    return one(db,'SELECT * FROM seven.stay_rate_plans WHERE rate_plan_id=$1',[planId]);
  }));

  app.put('/api/business/stay/nightly-rates', async(req,res)=>mutate(req,res,async(db,user)=>{
    const businessId=ownerBusiness(user); const input=nightlyInput.parse(req.body);
    const dates=dateRange(input.startDate,input.endDate);
    if(input.minStayNights && input.maxStayNights && input.minStayNights>input.maxStayNights)
      return fail(422,'INVALID_STAY_RULE','Minimum stay cannot exceed maximum stay.');
    const plan=await one(db,
      `SELECT rp.rate_plan_id,rp.room_type_id,rp.revision,rp.is_active,o.business_id
         FROM seven.stay_rate_plans rp JOIN seven.stay_room_types rt USING(room_type_id)
         JOIN seven.offerings o USING(offering_id)
        WHERE rp.rate_plan_id=$1 AND o.business_id=$2 FOR UPDATE OF rp`,
      [input.ratePlanId,businessId]);
    if(!plan || !plan.is_active) return fail(404,'RATE_PLAN_NOT_FOUND','Active rate plan not found.');
    const current=await rows(db,
      'SELECT service_date,revision FROM seven.stay_nightly_rates WHERE rate_plan_id=$1 AND service_date BETWEEN $2::date AND $3::date FOR UPDATE',
      [input.ratePlanId,input.startDate,input.endDate]);
    if(input.expectedRevision!==undefined && current.some(row=>Number(row.revision)!==input.expectedRevision))
      return fail(409,'REVISION_CONFLICT','Some nightly rates changed. Refresh the calendar and try again.');
    for(const date of dates){
      await db.query(
        `INSERT INTO seven.stay_nightly_rates(rate_plan_id,room_type_id,service_date,amount_minor,closed_to_arrival,closed_to_departure,min_stay_nights,max_stay_nights)
         VALUES($1,$2,$3,$4::bigint,$5,$6,$7,$8)
         ON CONFLICT(rate_plan_id,service_date) DO UPDATE SET amount_minor=EXCLUDED.amount_minor,
           closed_to_arrival=EXCLUDED.closed_to_arrival,closed_to_departure=EXCLUDED.closed_to_departure,
           min_stay_nights=EXCLUDED.min_stay_nights,max_stay_nights=EXCLUDED.max_stay_nights,
           revision=seven.stay_nightly_rates.revision+1,updated_at=now()`,
        [input.ratePlanId,plan.room_type_id,date,input.amountMinor,input.closedToArrival,input.closedToDeparture,input.minStayNights ?? null,input.maxStayNights ?? null]);
    }
    await S.audit(db,user,businessId,'stay_nightly_rates.bulk_updated',input.ratePlanId,\`Updated ${dates.length} nights from ${input.startDate} to ${input.endDate}.\`);
    return {ratePlanId:input.ratePlanId,updatedDates:dates};
  }));
}
