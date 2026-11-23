import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import type { SessionUser } from '@7even/contracts';
import { randomUUID } from 'node:crypto';
import { quotePrice, serviceDates } from '@7even/engine';
import { z } from 'zod';
import { fail, one, rows } from './db.ts';
import type { Connection } from './db.ts';
import * as S from './store.ts';

type Work = (db: Connection, actor: SessionUser) => Promise<unknown>;
interface Context {
  pool: Pool;
  mutate: (req: Request, res: Response, work: Work) => Promise<unknown>;
}

const uuid = z.uuid();
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const stayQuoteInput = z.strictObject({
  offeringId: uuid,
  roomTypeId: uuid,
  ratePlanId: uuid,
  checkInDate: localDate,
  checkOutDate: localDate,
  rooms: z.number().int().min(1).max(20),
  recoverySessionId: uuid.optional(),
});

function sendMutation(
  req: Request,
  res: Response,
  mutate: Context['mutate'],
  work: Work,
  next: NextFunction,
): void {
  void mutate(req, res, work)
    .then((data) => {
      if (!res.headersSent) res.json({ data });
    })
    .catch(next);
}

function isVerified(details: Record<string, unknown>, production: boolean): boolean {
  if (!production && details.isSample === true) return true;
  const review = details.verificationReview as
    | { checklistVersion?: unknown; inventoryFreshnessHours?: unknown }
    | undefined;
  return review?.checklistVersion === 1 &&
    typeof review.inventoryFreshnessHours === 'number' &&
    Number.isInteger(review.inventoryFreshnessHours) &&
    review.inventoryFreshnessHours >= 1 &&
    review.inventoryFreshnessHours <= 168;
}

export function mountStayBooking(
  app: Express,
  { pool, mutate }: Context,
  production: boolean,
): void {
  app.get('/api/offerings/:id/stay-rate-plans', async (req, res) => {
    const offeringId = uuid.parse(req.params.id);
    const checkInDate = localDate.parse(req.query.checkInDate);
    const checkOutDate = localDate.parse(req.query.checkOutDate);
    const rooms = z.coerce.number().int().min(1).max(20).parse(req.query.rooms ?? '1');
    const dates = serviceDates(checkInDate, checkOutDate);
    const offering = await one<{
      offering_id: string;
      business_id: string;
      venue_id: string;
      title: string;
      is_published: boolean;
      sector_code: string;
      business_status: string;
      business_details: Record<string, unknown>;
      inventory_freshness_hours: number;
    }>(
      pool,
      `SELECT o.offering_id,o.business_id,o.venue_id,o.title,o.is_published,
              s.sector_code,ws.workflow_state_code AS business_status,b.details AS business_details,
              COALESCE((b.details->'verificationReview'->>'inventoryFreshnessHours')::int,0) AS inventory_freshness_hours
         FROM seven.offerings o
         JOIN seven.sectors s USING(sector_id)
         JOIN seven.businesses b USING(business_id)
         JOIN seven.workflow_states ws USING(workflow_state_id)
        WHERE o.offering_id=$1`,
      [offeringId],
    );
    if (!offering || offering.sector_code !== 'STAY' ||
        offering.business_status !== 'APPROVED' || !offering.is_published ||
        !isVerified(offering.business_details, production)) {
      return fail(404, 'OFFERING_NOT_FOUND', 'This stay is not currently available to book.');
    }
    const plans = await rows<{
      room_type_id: string;
      offering_id: string;
      offering_title: string;
      inventory_freshness_hours: number;
      max_occupancy: number;
      room_name: string;
      bed_configuration: string;
      rate_plan_id: string;
      code: string;
      name: string;
      currency_code: string;
      meal_plan: string;
      refundable: boolean | null;
      cancellation_policy: string;
      revision: number;
    }>(
      pool,
      `SELECT rt.room_type_id,rt.offering_id,o.title AS offering_title,
              COALESCE((b.details->'verificationReview'->>'inventoryFreshnessHours')::int,0) AS inventory_freshness_hours,
              rt.max_occupancy,rt.name AS room_name,rt.bed_configuration,
              rp.rate_plan_id,rp.code,rp.name,rp.currency_code,rp.meal_plan,
              rp.refundable,rp.cancellation_policy,rp.revision
         FROM seven.stay_room_types rt
         JOIN seven.stay_rate_plans rp USING(room_type_id)
         JOIN seven.offerings o ON o.offering_id=rt.offering_id
         JOIN seven.sectors s USING(sector_id)
         JOIN seven.businesses b USING(business_id)
         JOIN seven.workflow_states ws USING(workflow_state_id)
        WHERE o.business_id=$1 AND o.venue_id=$2 AND o.is_published
          AND s.sector_code='STAY' AND ws.workflow_state_code='APPROVED'
          AND rt.is_active AND rp.is_active
        ORDER BY o.title,rp.name`,
      [offering.business_id, offering.venue_id],
    );
    const result = [];
    for (const plan of plans) {
      const nightly = await rows<{
        service_date: string;
        amount_minor: string;
        closed_to_arrival: boolean;
        closed_to_departure: boolean;
        min_stay_nights: number | null;
        max_stay_nights: number | null;
      }>(
        pool,
        `SELECT service_date::text,amount_minor::text,closed_to_arrival,closed_to_departure,
                min_stay_nights,max_stay_nights
           FROM seven.stay_nightly_rates
          WHERE rate_plan_id=$1 AND service_date = ANY($2::date[])
          ORDER BY service_date`,
        [plan.rate_plan_id, dates],
      );
      const inventory = await rows<{ service_date: string; capacity: number; allocated_count: number; fresh: boolean }>(
        pool,
        `SELECT (iw.starts_at AT TIME ZONE 'Africa/Lagos')::date::text AS service_date,
                iw.capacity,iw.allocated_count,
                seven.inventory_window_is_fresh(
                  iw.inventory_source,iw.inventory_confirmed_at,$2,$3
                ) AS fresh
           FROM seven.inventory_windows iw
          WHERE iw.offering_id=$1
            AND iw.room_type_id=$6
            AND (iw.starts_at AT TIME ZONE 'Africa/Lagos')::date >= $4::date
            AND (iw.starts_at AT TIME ZONE 'Africa/Lagos')::date < $5::date
          ORDER BY iw.starts_at`,
        [plan.offering_id, plan.inventory_freshness_hours, !production && offering.business_details.isSample === true, checkInDate, checkOutDate, plan.room_type_id],
      );
      const inventoryByDate = new Map(inventory.map((night) => [night.service_date, night]));
      const ratesByDate = new Map(nightly.map((night) => [night.service_date, night]));
      const complete = dates.every((date) => ratesByDate.has(date) && inventoryByDate.has(date));
      const available = complete && dates.every((date) => {
        const window = inventoryByDate.get(date)!;
        return window.fresh && window.capacity - window.allocated_count >= rooms;
      });
      const totalPerRoom = nightly.reduce((sum, night) => sum + BigInt(night.amount_minor), 0n);
      const minStay = Math.max(1, ...nightly.map((night) => night.min_stay_nights ?? 1));
      const maxStayValues = nightly.map((night) => night.max_stay_nights).filter((value): value is number => value !== null);
      const maxStay = maxStayValues.length ? Math.min(...maxStayValues) : null;
      const checkoutRule = await one<{ closed_to_departure: boolean }>(
        pool,
        'SELECT closed_to_departure FROM seven.stay_nightly_rates WHERE rate_plan_id=$1 AND service_date=$2::date',
        [plan.rate_plan_id, checkOutDate],
      );
      const restrictionsPass = !nightly[0]?.closed_to_arrival &&
        !checkoutRule?.closed_to_departure &&
        dates.length >= minStay &&
        (maxStay === null || dates.length <= maxStay);
      result.push({
        offeringId: plan.offering_id,
        offeringTitle: plan.offering_title,
        roomType: {
          id: plan.room_type_id,
          name: plan.room_name,
          maxOccupancy: plan.max_occupancy,
          bedConfiguration: plan.bed_configuration,
        },
        ratePlan: {
          id: plan.rate_plan_id,
          code: plan.code,
          name: plan.name,
          currencyCode: plan.currency_code,
          mealPlan: plan.meal_plan,
          refundable: plan.refundable,
          cancellationPolicy: plan.cancellation_policy,
          revision: plan.revision,
        },
        nightlyRates: nightly.map((night) => ({
          date: night.service_date,
          amountMinor: night.amount_minor,
        })),
        stayTotalPerRoomMinor: totalPerRoom.toString(),
        rooms,
        totalMinor: (totalPerRoom * BigInt(rooms)).toString(),
        available: available && restrictionsPass && plan.currency_code === 'NGN',
        unavailableReason: !complete ? 'RATE_OR_INVENTORY_MISSING'
          : !available ? 'INVENTORY_UNAVAILABLE'
          : !restrictionsPass ? 'STAY_RESTRICTION'
          : plan.currency_code !== 'NGN' ? 'CURRENCY_NOT_SUPPORTED' : null,
      });
    }
    return res.json({ data: { offeringId, checkInDate, checkOutDate, nights: dates.length, plans: result } });
  });

  app.post('/api/stay-quotes', (req, res, next) => sendMutation(req, res, mutate, async (db, user) => {
    if (user.role !== 'CUSTOMER')
      return fail(403, 'CUSTOMER_ACCOUNT_REQUIRED', 'Sign in with a customer account to request a stay quote.');
    const input = stayQuoteInput.parse(req.body);
    const dates = serviceDates(input.checkInDate, input.checkOutDate);
    const offering = await one<{
      offering_id: string;
      business_id: string;
      venue_id: string;
      title: string;
      city: string;
      price_minor: string;
      tax_bps: number;
      details: Record<string, unknown>;
      is_published: boolean;
      sector_code: string;
      business_status: string;
      business_details: Record<string, unknown>;
      inventory_freshness_hours: number;
    }>(
      db,
      `SELECT o.offering_id,o.business_id,o.venue_id,o.title,o.city,o.price_minor,o.tax_bps,o.details,o.is_published,
              s.sector_code,ws.workflow_state_code AS business_status,b.details AS business_details,
              COALESCE((b.details->'verificationReview'->>'inventoryFreshnessHours')::int,0) AS inventory_freshness_hours
         FROM seven.offerings o
         JOIN seven.sectors s USING(sector_id)
         JOIN seven.businesses b USING(business_id)
         JOIN seven.workflow_states ws USING(workflow_state_id)
        WHERE o.offering_id=$1`,
      [input.offeringId],
    );
    if (!offering || offering.sector_code !== 'STAY' || !offering.is_published ||
        offering.business_status !== 'APPROVED' || !isVerified(offering.business_details, production)) {
      return fail(409, 'OFFER_UNAVAILABLE', 'This stay is not currently available to book.');
    }
    const selected = await one<{
      room_type_id: string;
      offering_id: string;
      max_occupancy: number;
      room_name: string;
      bed_configuration: string;
      rate_plan_id: string;
      code: string;
      name: string;
      currency_code: string;
      meal_plan: string;
      refundable: boolean | null;
      cancellation_policy: string;
      revision: number;
    }>(
      db,
      `SELECT rt.room_type_id,rt.offering_id,rt.max_occupancy,rt.name AS room_name,rt.bed_configuration,
              rp.rate_plan_id,rp.code,rp.name,rp.currency_code,rp.meal_plan,
              rp.refundable,rp.cancellation_policy,rp.revision
         FROM seven.stay_room_types rt
         JOIN seven.stay_rate_plans rp USING(room_type_id)
        WHERE rt.room_type_id=$1 AND rp.rate_plan_id=$2 AND rt.offering_id=$3
          AND rt.is_active AND rp.is_active
        FOR SHARE OF rt,rp`,
      [input.roomTypeId, input.ratePlanId, input.offeringId],
    );
    if (!selected) return fail(409, 'RATE_PLAN_UNAVAILABLE', 'This room category or rate plan is no longer available.');
    if (selected.currency_code !== 'NGN')
      return fail(409, 'CURRENCY_NOT_SUPPORTED', 'This rate plan cannot be checked out in the current payment currency.');
    const nightly = await rows<{
      service_date: string;
      amount_minor: string;
      closed_to_arrival: boolean;
      closed_to_departure: boolean;
      min_stay_nights: number | null;
      max_stay_nights: number | null;
    }>(
      db,
      `SELECT service_date::text,amount_minor::text,closed_to_arrival,closed_to_departure,
              min_stay_nights,max_stay_nights
         FROM seven.stay_nightly_rates
        WHERE rate_plan_id=$1 AND service_date = ANY($2::date[])
        ORDER BY service_date`,
      [input.ratePlanId, dates],
    );
    if (nightly.length !== dates.length || !dates.every((date, index) => nightly[index]?.service_date === date))
      return fail(409, 'NIGHTLY_RATE_MISSING', 'A price is not available for every night. Ask the hotel to update its rates.');
    const totalNights = dates.length;
    const minimumNights = Math.max(1, ...nightly.map((night) => night.min_stay_nights ?? 1));
    const maximumValues = nightly.map((night) => night.max_stay_nights).filter((value): value is number => value !== null);
    const maximumNights = maximumValues.length ? Math.min(...maximumValues) : null;
    if (nightly[0]!.closed_to_arrival)
      return fail(409, 'CLOSED_TO_ARRIVAL', 'The hotel is not accepting check-ins on this date.');
    if (totalNights < minimumNights || (maximumNights !== null && totalNights > maximumNights))
      return fail(409, 'STAY_LENGTH_RESTRICTED', 'This rate plan does not allow the selected length of stay.');
    const checkoutRule = await one<{ closed_to_departure: boolean }>(
      db,
      'SELECT closed_to_departure FROM seven.stay_nightly_rates WHERE rate_plan_id=$1 AND service_date=$2::date',
      [input.ratePlanId, input.checkOutDate],
    );
    if (checkoutRule?.closed_to_departure)
      return fail(409, 'CLOSED_TO_DEPARTURE', 'The hotel is not accepting check-outs on this date.');

    const windows = await rows<{
      inventory_window_id: string;
      service_date: string;
      starts_at: Date;
      ends_at: Date;
      capacity: number;
      allocated_count: number;
      inventory_fresh: boolean;
    }>(
      db,
      `SELECT iw.*,(iw.starts_at AT TIME ZONE 'Africa/Lagos')::date::text AS service_date,
              seven.inventory_window_is_fresh(iw.inventory_source,iw.inventory_confirmed_at,$2,$3) AS inventory_fresh
         FROM seven.inventory_windows iw
        WHERE iw.offering_id=$1
            AND iw.room_type_id=$6
          AND (iw.starts_at AT TIME ZONE 'Africa/Lagos')::date >= $4::date
          AND (iw.starts_at AT TIME ZONE 'Africa/Lagos')::date < $5::date
        ORDER BY iw.starts_at
        FOR SHARE`,
      [input.offeringId, offering.inventory_freshness_hours, !production && offering.business_details.isSample === true, input.checkInDate, input.checkOutDate, selected.room_type_id],
    );
    if (windows.length !== dates.length)
      return fail(409, 'CAPACITY_CHANGED', 'The hotel has not confirmed availability for every night.');
    for (let index = 0; index < dates.length; index++) {
      const window = windows[index]!;
      if (window.service_date !== dates[index])
        return fail(409, 'CAPACITY_CHANGED', 'The hotel has not confirmed availability for every night.');
      if (!window.inventory_fresh)
        return fail(409, 'INVENTORY_STALE', 'The hotel must confirm its availability before this stay can be quoted.');
      if (window.capacity - window.allocated_count < input.rooms)
        return fail(409, 'CAPACITY_CHANGED', 'There are not enough rooms available for every night.');
    }
    const policy = await one(db, 'SELECT * FROM seven.policies ORDER BY policy_id DESC LIMIT 1');
    const nightlyBreakdown = nightly.map((night) => ({
      date: night.service_date,
      amountMinor: night.amount_minor,
      quantity: input.rooms,
      lineTotalMinor: (BigInt(night.amount_minor) * BigInt(input.rooms)).toString(),
    }));
    const basePerRoom = nightly.reduce((sum, night) => sum + BigInt(night.amount_minor), 0n);
    const amounts = quotePrice({
      unitPriceMinor: basePerRoom.toString(),
      quantity: input.rooms,
      units: 1,
      taxBps: offering.tax_bps,
      discountBps: Number(offering.details.discountBps ?? 0),
      commissionBps: 1000,
    });
    const quoteId = randomUUID();
    const holdMinutes = Number(policy?.hold_minutes ?? 15);
    const termsSnapshot = {
      title: offering.title,
      kind: 'STAY',
      city: offering.city,
      image: Array.isArray(offering.details.images) ? offering.details.images[0] ?? null : null,
      venueId: offering.venue_id,
      startDate: input.checkInDate,
      endDate: input.checkOutDate,
      startAt: new Date(windows[0]!.starts_at).toISOString(),
      quantity: input.rooms,
      units: totalNights,
      policyVersion: Number(policy?.policy_id ?? 1),
      holdMinutes,
      cancellationHours: Number(offering.details.cancellationHours ?? 24),
      roomType: {
        id: selected.room_type_id,
        name: selected.room_name,
        maxOccupancy: selected.max_occupancy,
        bedConfiguration: selected.bed_configuration,
      },
      ratePlan: {
        id: selected.rate_plan_id,
        code: selected.code,
        name: selected.name,
        currencyCode: selected.currency_code,
        mealPlan: selected.meal_plan,
        refundable: selected.refundable,
        cancellationPolicy: selected.cancellation_policy,
        revision: selected.revision,
      },
      nightlyBreakdown,
      cancellationPolicySnapshot: {
        refundable: selected.refundable,
        policy: selected.cancellation_policy,
        cancellationHours: Number(offering.details.cancellationHours ?? 24),
      },
    };
    await db.query(
      `INSERT INTO seven.quotes(quote_id,user_id,offering_id,starts_at,ends_at,quantity,amounts,inventory_ids,expires_at,terms_snapshot,recovery_session_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '10 minutes',$9,$10)`,
      [quoteId,user.id,offering.offering_id,windows[0]!.starts_at,windows[windows.length-1]!.ends_at,
        input.rooms,amounts,JSON.stringify(windows.map((window) => window.inventory_window_id)),termsSnapshot,input.recoverySessionId ?? null],
    );
    await S.observation(db, offering.business_id, offering.offering_id, 'QUOTE', `quote:${quoteId}`);
    const quote = await S.quoteProjection(db, quoteId);
    return {
      quote,
      roomType: termsSnapshot.roomType,
      ratePlan: termsSnapshot.ratePlan,
      nightlyBreakdown,
      cancellationPolicySnapshot: termsSnapshot.cancellationPolicySnapshot,
    };
  }, next));
}
