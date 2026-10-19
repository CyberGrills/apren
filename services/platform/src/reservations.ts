import { randomUUID } from 'node:crypto';
import { quotePrice, serviceDates, earnPoints, allowedTransition } from '@7even/engine';
import type { SessionUser, Quote, Reservation } from '@7even/contracts';
import { one, rows, fail } from './db.ts';
import type { Connection } from './db.ts';
import {
  sid,
  offeringProjection,
  quoteProjection,
  reservationProjection,
  requireTenant,
  audit,
  observation,
  notify,
  pointsJournal,
  requireVenue,
} from './store.ts';

export async function releaseAllocation(db: Connection, reservationId: string): Promise<void> {
  const allocations = await rows(
    db,
    'SELECT * FROM seven.allocations WHERE reservation_id=$1 AND is_active ORDER BY inventory_window_id FOR UPDATE',
    [reservationId],
  );
  for (const allocation of allocations) {
    await db.query(
      'UPDATE seven.inventory_windows SET allocated_count=allocated_count-$1,revision=revision+1,updated_at=now() WHERE inventory_window_id=$2',
      [allocation.quantity, allocation.inventory_window_id],
    );
    await db.query(
      'UPDATE seven.allocations SET is_active=false,updated_at=now() WHERE allocation_id=$1',
      [allocation.allocation_id],
    );
  }
}
export async function expireHolds(db: Connection): Promise<number> {
  const expired = await rows(
    db,
    `SELECT reservation_id FROM seven.reservations WHERE workflow_state_id=${sid('HELD')} AND expires_at<=now() ORDER BY reservation_id FOR UPDATE SKIP LOCKED LIMIT 100`,
  );
  for (const r of expired) {
    await releaseAllocation(db, r.reservation_id);
    await db.query(
      `UPDATE seven.reservations SET workflow_state_id=${sid('EXPIRED')},revision=revision+1,updated_at=now() WHERE reservation_id=$1`,
      [r.reservation_id],
    );
  }
  return expired.length;
}
export async function createQuote(
  db: Connection,
  actor: SessionUser,
  input: {
    offeringId: string;
    startDate: string;
    endDate?: string;
    windowId?: string;
    quantity: number;
  },
): Promise<Quote> {
  const offer = await offeringProjection(db, input.offeringId);
  if (!offer) return fail(404, 'NOT_FOUND', 'This offering was not found.');
  if (offer.kind === 'STAY') {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const part = (name: string) => parts.find((value) => value.type === name)?.value ?? '';
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    if (input.startDate < today)
      return fail(422, 'PAST_CHECK_IN', 'Check-in must be today or a future date in the hotel time zone.');
  }
  if (actor.role === 'RECEPTION') {
    requireTenant(actor, offer.businessId);
    requireVenue(actor, offer.venueId);
  }
  const business = await one(
    db,
    'SELECT workflow_state_id FROM seven.businesses WHERE business_id=$1',
    [offer.businessId],
  );
  const approved = await one(
    db,
    `SELECT 1 FROM seven.businesses WHERE business_id=$1 AND workflow_state_id=${sid('APPROVED')}`,
    [offer.businessId],
  );
  if (!business || !approved || (!offer.published && actor.businessId !== offer.businessId))
    return fail(409, 'OFFER_UNAVAILABLE', 'This offering is not available to book.');
  const dates =
    offer.kind === 'STAY'
      ? serviceDates(input.startDate, input.endDate ?? input.startDate)
      : [input.startDate];
  const selected = offer.windows.filter(
    (w) => dates.includes(w.serviceDate) && (!input.windowId || w.id === input.windowId),
  );
  if (
    (offer.kind === 'STAY' && selected.length !== dates.length) ||
    (offer.kind !== 'STAY' && selected.length !== 1)
  )
    return fail(409, 'CAPACITY_CHANGED', 'Choose an available service date or sitting.');
  if (selected.some((w) => w.remaining < input.quantity || new Date(w.endAt) <= new Date()))
    return fail(409, 'CAPACITY_CHANGED', 'There is not enough availability for this request.');
  const policy = await one(db, 'SELECT * FROM seven.policies ORDER BY policy_id DESC LIMIT 1');
  const price = quotePrice({
    unitPriceMinor: offer.priceMinor,
    quantity: input.quantity,
    units: offer.kind === 'STAY' ? dates.length : 1,
    taxBps: offer.taxBps,
    discountBps: offer.discountBps,
    commissionBps: 1000,
  });
  const id = randomUUID();
  const terms = {
    title: offer.title,
    kind: offer.kind,
    city: offer.city,
    image: offer.images[0] ?? null,
    venueId: offer.venueId,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    startAt: selected[0]?.startAt,
    quantity: input.quantity,
    units: offer.kind === 'STAY' ? dates.length : 1,
    policyVersion: Number(policy?.policy_id ?? 1),
    holdMinutes: policy?.hold_minutes ?? 15,
    cancellationHours: offer.cancellationHours,
  };
  await db.query(
    "INSERT INTO seven.quotes(quote_id,user_id,offering_id,starts_at,ends_at,quantity,amounts,inventory_ids,expires_at,terms_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '10 minutes',$9)",
    [
      id,
      actor.id,
      offer.id,
      selected[0]?.startAt,
      selected[selected.length - 1]?.endAt,
      input.quantity,
      price,
      JSON.stringify(selected.map((w) => w.id)),
      terms,
    ],
  );
  await observation(db, offer.businessId, offer.id, 'QUOTE', `quote:${id}`);
  return (await quoteProjection(db, id))!;
}
export async function createReservation(
  db: Connection,
  actor: SessionUser,
  quoteId: string,
  walkIn = false,
  userId = actor.id,
): Promise<Reservation> {
  await expireHolds(db);
  // Quotes are immutable to the runtime role. Serialize their claim without granting UPDATE.
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`quote:${quoteId}`]);
  const quote = await one(db, 'SELECT * FROM seven.quotes WHERE quote_id=$1', [quoteId]);
  if (!quote || quote.user_id !== actor.id)
    return fail(404, 'NOT_FOUND', 'This quote was not found.');
  if (new Date(quote.expires_at) <= new Date())
    return fail(409, 'QUOTE_EXPIRED', 'This quote has expired. Request a new quote.');
  if (await one(db, 'SELECT reservation_id FROM seven.reservations WHERE quote_id=$1', [quoteId]))
    return fail(409, 'QUOTE_USED', 'This quote already has a reservation.');
  const offer = await offeringProjection(db, quote.offering_id);
  if (
    !offer ||
    !(await one(
      db,
      `SELECT 1 FROM seven.businesses WHERE business_id=$1 AND workflow_state_id=${sid('APPROVED')}`,
      [offer.businessId],
    ))
  )
    return fail(
      409,
      'OFFER_UNAVAILABLE',
      'This business is not currently available for reservations.',
    );
  if (!offer?.published)
    return fail(409, 'OFFER_UNAVAILABLE', 'This offering is no longer available.');
  if (walkIn) {
    requireTenant(actor, offer.businessId);
    requireVenue(actor, offer.venueId);
  }
  for (const windowId of [...quote.inventory_ids].sort()) {
    const inventory = await one(
      db,
      'SELECT * FROM seven.inventory_windows WHERE inventory_window_id=$1 FOR UPDATE',
      [windowId],
    );
    if (
      !inventory ||
      inventory.allocated_count + quote.quantity > inventory.capacity ||
      new Date(inventory.ends_at) <= new Date()
    )
      return fail(409, 'CAPACITY_CHANGED', 'This availability has changed. Choose another date.');
  }
  const policy = await one(db, 'SELECT * FROM seven.policies WHERE policy_id=$1', [
    quote.terms_snapshot.policyVersion,
  ]);
  if (!policy) return fail(409, 'POLICY_MISSING', 'The accepted hold policy is unavailable.');
  const id = randomUUID();
  await db.query(
    `INSERT INTO seven.reservations(reservation_id,user_id,business_id,offering_id,quote_id,workflow_state_id,payment_state_id,expires_at,is_walk_in) VALUES($1,$2,$3,$4,$5,${sid('HELD')},${sid('UNPAID')},now()+($6 * interval '1 minute'),$7)`,
    [id, userId, offer.businessId, offer.id, quoteId, policy?.hold_minutes ?? 15, walkIn],
  );
  for (const windowId of [...quote.inventory_ids].sort()) {
    await db.query(
      'UPDATE seven.inventory_windows SET allocated_count=allocated_count+$1,revision=revision+1,updated_at=now() WHERE inventory_window_id=$2',
      [quote.quantity, windowId],
    );
    await db.query(
      'INSERT INTO seven.allocations(allocation_id,reservation_id,inventory_window_id,quantity) VALUES($1,$2,$3,$4)',
      [randomUUID(), id, windowId, quote.quantity],
    );
  }
  await audit(db, actor, offer.businessId, 'reservation.held', id);
  await observation(db, offer.businessId, offer.id, 'RESERVATION', `reservation:${id}`);
  await notify(
    db,
    userId,
    'Your reservation is held',
    'Complete checkout before the hold expires.',
  );
  return (await reservationProjection(db, id))!;
}
export async function reservationAccess(
  db: Connection,
  actor: SessionUser,
  r: Reservation,
): Promise<void> {
  if (r.customerId === actor.id) return;
  requireTenant(actor, r.businessId);
  const offering = await offeringProjection(db, r.offeringId);
  if (offering) requireVenue(actor, offering.venueId);
}
export async function actOnReservation(
  db: Connection,
  actor: SessionUser,
  id: string,
  input: { action: 'CHECK_IN' | 'FULFILL' | 'CANCEL'; expectedRevision: number; reason?: string },
): Promise<Reservation> {
  await one(
    db,
    'SELECT reservation_id FROM seven.reservations WHERE reservation_id=$1 FOR UPDATE',
    [id],
  );
  const r = await reservationProjection(db, id);
  if (!r) return fail(404, 'NOT_FOUND', 'Reservation not found.');
  await reservationAccess(db, actor, r);
  const offering = await offeringProjection(db, r.offeringId);
  if (offering) requireVenue(actor, offering.venueId);
  if (r.revision !== input.expectedRevision)
    return fail(409, 'REVISION_CONFLICT', 'This reservation changed. Refresh and review it.');
  if (input.action !== 'CANCEL') requireTenant(actor, r.businessId);
  if (input.action === 'CANCEL' && actor.id === r.customerId) {
    const quote = await one(
      db,
      'SELECT starts_at,terms_snapshot FROM seven.quotes q JOIN seven.reservations r USING(quote_id) WHERE reservation_id=$1',
      [id],
    );
    if (
      r.status !== 'HELD' &&
      new Date(quote?.starts_at).getTime() - Date.now() <
        Number(quote?.terms_snapshot.cancellationHours ?? 24) * 3600000
    )
      return fail(409, 'CANCELLATION_CLOSED', 'Contact the business about this cancellation.');
  }
  if (!allowedTransition(r.status, input.action))
    return fail(
      409,
      'INVALID_TRANSITION',
      'This action is not available for the current reservation.',
    );
  if (input.action !== 'CANCEL' && r.paymentStatus !== 'PAID')
    return fail(409, 'PAYMENT_REQUIRED', 'The provider must confirm payment before this action.');
  const next =
    input.action === 'CHECK_IN'
      ? 'CHECKED_IN'
      : input.action === 'FULFILL'
        ? 'FULFILLED'
        : 'CANCELLED';
  if (next === 'CANCELLED') await releaseAllocation(db, id);
  await db.query(
    `UPDATE seven.reservations SET workflow_state_id=${sid(next)},revision=revision+1,fulfilled_at=CASE WHEN $2='FULFILLED' THEN now() ELSE fulfilled_at END,updated_at=now() WHERE reservation_id=$1`,
    [id, next],
  );
  if (next === 'FULFILLED') {
    const quote = await one(
      db,
      'SELECT terms_snapshot FROM seven.quotes q JOIN seven.reservations r USING(quote_id) WHERE r.reservation_id=$1',
      [id],
    );
    const policy = await one(db, 'SELECT * FROM seven.policies WHERE policy_id=$1', [
      quote?.terms_snapshot.policyVersion,
    ]);
    if (!policy) return fail(409, 'POLICY_MISSING', 'The accepted earning policy is unavailable.');
    const points = earnPoints(
      r.price.serviceMinor,
      String(policy?.earn_spend_minor ?? '100000'),
      Number(policy?.earn_points ?? 10),
    );
    await db.query('SELECT user_id FROM seven.users WHERE user_id=$1 FOR UPDATE', [r.customerId]);
    await pointsJournal(db, `earn:${id}`, `Completed visit: ${r.title}`, [
      { account: `customer:${r.customerId}`, amount: points },
      { account: 'issuer', amount: -points },
    ]);
    await observation(db, r.businessId, r.offeringId, 'FULFILLED', `fulfilled:${id}`);
    await notify(
      db,
      r.customerId,
      'Thanks for visiting',
      `Your completed visit earned ${points} points.`,
      '/app/points',
    );
  }
  if (next === 'CANCELLED')
    await observation(db, r.businessId, r.offeringId, 'CANCELLED', `cancelled:${id}`);
  await audit(db, actor, r.businessId, `reservation.${next.toLowerCase()}`, id, input.reason ?? '');
  return (await reservationProjection(db, id))!;
}
