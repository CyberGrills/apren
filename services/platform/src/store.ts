import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type {
  Business,
  Offering,
  Quote,
  Reservation,
  Payment,
  SessionUser,
  Reward,
  Benefit,
  Trade,
  PointsAccount,
  Activity,
  Notification,
  Metrics,
} from '@7even/contracts';
import { one, rows, fail } from './db.ts';
import type { Connection } from './db.ts';

export const sid = (code: string): string =>
  `(SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='${code}')`;
export const iso = (value: Date | string | null | undefined): string =>
  value ? new Date(value).toISOString() : '';
export const stateColumns = `(SELECT workflow_state_code FROM seven.workflow_states s WHERE s.workflow_state_id=r.workflow_state_id) AS state_code`;
export async function audit(
  db: Connection,
  actor: SessionUser | null,
  businessId: string | null,
  action: string,
  resourceId: string | null,
  detail = '',
): Promise<void> {
  const id = randomUUID();
  await db.query(
    'INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details) VALUES($1,$2,$3,$4,$5,$6)',
    [id, actor?.id ?? null, businessId, action, resourceId, { detail }],
  );
  await db.query(
    'INSERT INTO seven.outbox_events(outbox_event_id,business_id,event_code,details) VALUES($1,$2,$3,$4)',
    [randomUUID(), businessId, action, { actorId: actor?.id, resourceId }],
  );
}
export async function notify(
  db: Connection,
  userId: string,
  title: string,
  body: string,
  href = '/app/bookings',
): Promise<void> {
  if (!href.startsWith('/') || href.startsWith('//'))
    throw new Error('Notifications require an internal destination.');
  await db.query(
    'INSERT INTO seven.notifications(notification_id,user_id,title,body,href) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), userId, title, body, href],
  );
}
export async function observation(
  db: Connection,
  businessId: string,
  offeringId: string | null,
  event: string,
  reference: string,
): Promise<void> {
  await db.query(
    "INSERT INTO seven.observations(observation_id,business_id,offering_id,event_code,source_reference,is_synthetic) VALUES($1,$2,$3,$4,$5,coalesce((SELECT details->>'isSample'='true' FROM seven.businesses WHERE business_id=$2),false)) ON CONFLICT(source_reference) DO NOTHING",
    [randomUUID(), businessId, offeringId, event, reference],
  );
}
export async function moneyJournal(
  db: Connection,
  reference: string,
  description: string,
  postings: { account: string; amount: string }[],
): Promise<void> {
  if (postings.reduce((sum, item) => sum + BigInt(item.amount), 0n) !== 0n)
    throw new Error('Unbalanced monetary operation.');
  const id = randomUUID();
  const inserted = await one(
    db,
    "INSERT INTO seven.money_journals(money_journal_id,source_reference,currency_code,description) VALUES($1,$2,'NGN',$3) ON CONFLICT(source_reference) DO NOTHING RETURNING money_journal_id",
    [id, reference, description],
  );
  if (!inserted) return;
  for (const item of postings)
    await db.query(
      'INSERT INTO seven.money_postings(money_posting_id,money_journal_id,account_code,amount_minor) VALUES($1,$2,$3,$4)',
      [randomUUID(), id, item.account, item.amount],
    );
}
export async function pointsJournal(
  db: Connection,
  reference: string,
  description: string,
  postings: { account: string; amount: number }[],
): Promise<void> {
  if (postings.reduce((sum, item) => sum + BigInt(item.amount), 0n) !== 0n)
    throw new Error('Unbalanced points operation.');
  for (const posting of [...postings].sort((a, b) => a.account.localeCompare(b.account))) {
    if (!Number.isSafeInteger(posting.amount))
      return fail(409, 'POINTS_LIMIT', 'This points entry exceeds the supported limit.');
    if (posting.account.startsWith('customer:')) {
      await db.query('SELECT user_id FROM seven.users WHERE user_id=$1 FOR UPDATE', [
        posting.account.slice(9),
      ]);
      if (
        await one(
          db,
          'SELECT points_journal_id FROM seven.points_journals WHERE source_reference=$1',
          [reference],
        )
      )
        return;
      const current = await one(
        db,
        'SELECT coalesce(sum(points),0) AS total FROM seven.points_postings WHERE account_code=$1',
        [posting.account],
      );
      safePoints((BigInt(current?.total ?? '0') + BigInt(posting.amount)).toString());
    }
  }
  const id = randomUUID();
  const inserted = await one(
    db,
    'INSERT INTO seven.points_journals(points_journal_id,source_reference,description) VALUES($1,$2,$3) ON CONFLICT(source_reference) DO NOTHING RETURNING points_journal_id',
    [id, reference, description],
  );
  if (!inserted) return;
  for (const item of postings)
    await db.query(
      'INSERT INTO seven.points_postings(points_posting_id,points_journal_id,account_code,points) VALUES($1,$2,$3,$4)',
      [randomUUID(), id, item.account, item.amount],
    );
}
export async function userProjection(db: Connection, userId: string): Promise<SessionUser | null> {
  const u = await one(
    db,
    `SELECT u.*,r.role_code,m.business_id,m.role_id AS membership_role_id,m.venue_id AS membership_venue_id FROM seven.users u JOIN seven.roles r USING(role_id) LEFT JOIN seven.memberships m ON m.user_id=u.user_id AND m.is_active WHERE u.user_id=$1 AND u.is_active ORDER BY m.created_at LIMIT 1`,
    [userId],
  );
  if (!u) return null;
  let role = u.role_code;
  if (u.membership_role_id && role !== 'ADMIN')
    role = (
      await one(db, 'SELECT role_code FROM seven.roles WHERE role_id=$1', [u.membership_role_id])
    )?.role_code;
  const venues = u.business_id
    ? await rows(
        db,
        'SELECT venue_id FROM seven.venues WHERE business_id=$1 AND is_active AND ($2::uuid IS NULL OR venue_id=$2)',
        [u.business_id, u.membership_venue_id ?? null],
      )
    : [];
  return {
    id: u.user_id,
    email: u.email,
    displayName: u.display_name,
    phone: u.phone,
    role,
    businessId: u.business_id ?? null,
    venueIds: venues.map((v) => v.venue_id),
  };
}
export async function businessProjection(db: Connection, id: string): Promise<Business | null> {
  const r = await one(
    db,
    `SELECT r.*,${stateColumns} FROM seven.businesses r WHERE business_id=$1`,
    [id],
  );
  if (!r) return null;
  return {
    id: r.business_id,
    businessName: r.business_name,
    city: r.city,
    address: r.details.address ?? '',
    description: r.description,
    phone: r.details.phone ?? '',
    sector: r.details.sector ?? 'STAY',
    status: r.state_code,
    subaccountConfigured: !!r.subaccount_id,
    accountLabel: r.details.accountLabel ?? null,
    createdAt: iso(r.created_at),
    isSample: !!r.details.isSample,
  };
}
export async function offeringProjection(db: Connection, id: string): Promise<Offering | null> {
  const r = await one(
    db,
    `SELECT o.*,s.sector_code,b.business_name,b.details AS business_details FROM seven.offerings o JOIN seven.sectors s USING(sector_id) JOIN seven.businesses b USING(business_id) WHERE offering_id=$1`,
    [id],
  );
  if (!r) return null;
  const windows = await rows(
    db,
    'SELECT * FROM seven.inventory_windows WHERE offering_id=$1 ORDER BY starts_at LIMIT 500',
    [id],
  );
  return {
    id: r.offering_id,
    businessId: r.business_id,
    venueId: r.venue_id ?? '',
    businessName: r.business_name,
    title: r.title,
    description: r.description,
    kind: r.sector_code,
    city: r.city,
    address: r.details.address ?? r.business_details.address ?? '',
    priceMinor: r.price_minor,
    currency: 'NGN',
    unitLabel: r.sector_code === 'STAY' ? 'night' : r.sector_code === 'DINING' ? 'guest' : 'person',
    capacity: r.details.capacity ?? 1,
    images: r.details.images ?? [],
    amenities: r.details.amenities ?? [],
    cancellationHours: r.details.cancellationHours ?? 24,
    taxBps: r.tax_bps,
    discountBps: r.details.discountBps ?? 0,
    published: r.is_published,
    revision: r.revision,
    isSample: !!r.business_details.isSample,
    windows: windows.map((w) => ({
      id: w.inventory_window_id,
      serviceDate: new Date(new Date(w.starts_at).getTime() + 3600000).toISOString().slice(0, 10),
      startAt: iso(w.starts_at),
      endAt: iso(w.ends_at),
      capacity: w.capacity,
      remaining: w.capacity - w.allocated_count,
      revision: w.revision,
    })),
  };
}
export async function quoteProjection(db: Connection, id: string): Promise<Quote | null> {
  const r = await one(db, 'SELECT * FROM seven.quotes WHERE quote_id=$1', [id]);
  if (!r) return null;
  return {
    id: r.quote_id,
    offeringId: r.offering_id,
    title: r.terms_snapshot.title,
    startDate: r.terms_snapshot.startDate,
    endDate: r.terms_snapshot.endDate ?? null,
    windowIds: r.inventory_ids,
    quantity: r.quantity,
    units: r.terms_snapshot.units,
    price: r.amounts,
    currency: 'NGN',
    expiresAt: iso(r.expires_at),
    policyVersion: r.terms_snapshot.policyVersion,
  };
}
export const reservationSelect = `SELECT r.*,${stateColumns},p.workflow_state_code AS payment_code,(SELECT timezone_name FROM seven.venues v WHERE v.venue_id=o.venue_id) AS venue_timezone,o.title,o.city,o.details,s.sector_code,u.display_name,u.email,q.terms_snapshot,q.amounts, coalesce(r.funding_payment_attempt_id,(SELECT payment_attempt_id FROM seven.payment_attempts pa WHERE pa.reservation_id=r.reservation_id ORDER BY created_at LIMIT 1)) AS payment_id FROM seven.reservations r JOIN seven.workflow_states p ON p.workflow_state_id=r.payment_state_id JOIN seven.offerings o USING(offering_id) JOIN seven.sectors s USING(sector_id) JOIN seven.users u ON u.user_id=r.user_id JOIN seven.quotes q USING(quote_id)`;
export async function reservationProjection(
  db: Connection,
  id: string,
): Promise<Reservation | null> {
  const r = await one(db, `${reservationSelect} WHERE reservation_id=$1`, [id]);
  return r ? reservationRow(db, r) : null;
}
export async function reservationRow(db: Connection, r: QueryResultRow): Promise<Reservation> {
  const payment = r.payment_id ? await paymentProjection(db, r.payment_id) : null;
  return {
    id: r.reservation_id,
    reference: `7E-${String(r.reservation_id).slice(0, 8).toUpperCase()}`,
    offeringId: r.offering_id,
    businessId: r.business_id,
    title: r.terms_snapshot.title ?? r.title,
    kind: r.terms_snapshot.kind ?? r.sector_code,
    city: r.terms_snapshot.city ?? r.city,
    image: r.terms_snapshot.image ?? r.details.images?.[0] ?? null,
    customerId: r.user_id,
    customerName: r.display_name,
    customerEmail: r.email,
    startDate: r.terms_snapshot.startDate,
    endDate: r.terms_snapshot.endDate ?? null,
    startAt: r.terms_snapshot.startAt ?? null,
    quantity: r.terms_snapshot.quantity ?? r.quantity ?? 1,
    status: r.state_code,
    paymentStatus: r.payment_code,
    settlementStatus: payment?.settlementStatus ?? 'UNSETTLED',
    price: r.amounts,
    holdExpiresAt: r.state_code === 'HELD' ? iso(r.expires_at) : null,
    revision: r.revision,
    createdAt: iso(r.created_at),
    fulfilledAt: r.fulfilled_at ? iso(r.fulfilled_at) : null,
    paymentId: r.payment_id ?? null,
  };
}
export async function paymentProjection(db: Connection, id: string): Promise<Payment | null> {
  const r = await one(
    db,
    `SELECT r.*,${stateColumns},s.workflow_state_code AS settlement_code FROM seven.payment_attempts r JOIN seven.workflow_states s ON s.workflow_state_id=r.settlement_state_id WHERE payment_attempt_id=$1`,
    [id],
  );
  if (!r) return null;
  return {
    id: r.payment_attempt_id,
    reservationId: r.reservation_id,
    reference: r.merchant_reference,
    providerTransactionId: r.provider_transaction_id ?? null,
    status: r.state_code,
    settlementStatus: r.settlement_code,
    amountMinor: r.amount_minor,
    commissionMinor: r.commission_minor,
    feeMinor: r.provider_details.feeMinor ?? null,
    merchantExpectedMinor: (
      BigInt(r.amount_minor) -
      BigInt(r.commission_minor) -
      BigInt(r.provider_details.feeMinor ?? '0')
    ).toString(),
    currency: 'NGN',
    createdAt: iso(r.created_at),
    verifiedAt: r.provider_details.verifiedAt ?? null,
    mode: r.provider_details.mode ?? 'mock',
  };
}
export async function rewardProjection(db: Connection, id: string): Promise<Reward | null> {
  const r = await one(
    db,
    'SELECT r.*,b.business_name FROM seven.rewards r JOIN seven.businesses b USING(business_id) WHERE reward_id=$1',
    [id],
  );
  return r
    ? {
        id: r.reward_id,
        businessId: r.business_id,
        businessName: r.business_name,
        title: r.title,
        description: r.description,
        pointsCost: r.points_cost,
        remaining: r.remaining_count,
        capacity: r.initial_capacity,
        expiresAt: iso(r.expires_at),
        transferable: r.is_transferable,
        published: r.is_published,
        revision: r.revision,
      }
    : null;
}
export async function benefitProjection(db: Connection, id: string): Promise<Benefit | null> {
  const r = await one(
    db,
    `SELECT r.*,${stateColumns},w.title,w.description,b.business_name FROM seven.entitlements r JOIN seven.rewards w USING(reward_id) JOIN seven.businesses b ON b.business_id=r.business_id WHERE entitlement_id=$1`,
    [id],
  );
  return r
    ? {
        id: r.entitlement_id,
        rewardId: r.reward_id,
        businessId: r.business_id,
        businessName: r.business_name,
        ownerId: r.user_id,
        title: r.title,
        description: r.description,
        status:
          r.state_code === 'AVAILABLE' && new Date(r.expires_at) <= new Date()
            ? 'EXPIRED'
            : r.is_locked
              ? 'LOCKED'
              : r.state_code,
        expiresAt: iso(r.expires_at),
        transferable: r.is_transferable,
        redemptionCode: r.redemption_code,
        revision: r.revision,
      }
    : null;
}
export async function tradeProjection(db: Connection, id: string): Promise<Trade | null> {
  const r = await one(
    db,
    `SELECT r.*,${stateColumns},w.title,u.display_name AS sender_name,v.display_name AS recipient_name,(SELECT rw.title FROM seven.entitlements e JOIN seven.rewards rw USING(reward_id) WHERE e.entitlement_id=r.desired_entitlement_id) AS desired_title FROM seven.exchanges r JOIN seven.entitlements e USING(entitlement_id) JOIN seven.rewards w USING(reward_id) JOIN seven.users u ON u.user_id=r.proposer_user_id JOIN seven.users v ON v.user_id=r.recipient_user_id WHERE exchange_id=$1`,
    [id],
  );
  return r
    ? {
        id: r.exchange_id,
        benefitId: r.entitlement_id,
        benefitTitle: r.title,
        requestedBenefitId: r.desired_entitlement_id ?? null,
        requestedBenefitTitle: r.desired_title ?? null,
        senderId: r.proposer_user_id,
        recipientId: r.recipient_user_id,
        senderName: r.sender_name,
        recipientName: r.recipient_name,
        status: r.state_code,
        revision: r.revision,
        expiresAt: iso(r.expires_at),
        createdAt: iso(r.created_at),
      }
    : null;
}
export async function pointsProjection(db: Connection, userId: string): Promise<PointsAccount> {
  const entries = await rows(
    db,
    'SELECT p.*,j.source_reference,j.description FROM seven.points_postings p JOIN seven.points_journals j USING(points_journal_id) WHERE account_code=$1 ORDER BY p.created_at DESC LIMIT 250',
    [`customer:${userId}`],
  );
  const sum = await one(
    db,
    'SELECT coalesce(sum(points),0) AS total FROM seven.points_postings WHERE account_code=$1',
    [`customer:${userId}`],
  );
  const balance = safePoints(sum?.total ?? '0');
  return {
    balance,
    available: Math.max(0, balance),
    reserved: 0,
    shortfall: Math.max(0, -balance),
    entries: entries.map((e) => ({
      id: e.points_posting_id,
      amount: safePoints(e.points),
      entryType: String(e.source_reference).split(':')[0] ?? 'POINTS',
      description: e.description,
      createdAt: iso(e.created_at),
      sourceId: e.source_reference,
    })),
  };
}
export function safePoints(value: string): number {
  const exact = BigInt(value);
  if (exact > BigInt(Number.MAX_SAFE_INTEGER) || exact < -BigInt(Number.MAX_SAFE_INTEGER))
    return fail(409, 'POINTS_LIMIT', 'This points account needs review before another change.');
  return Number(exact);
}
export async function notifications(db: Connection, userId: string): Promise<Notification[]> {
  return (
    await rows(
      db,
      'SELECT * FROM seven.notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [userId],
    )
  ).map((r) => ({
    id: r.notification_id,
    title: r.title,
    body: r.body,
    href: r.href,
    createdAt: iso(r.created_at),
    readAt: r.read_at ? iso(r.read_at) : null,
  }));
}
export async function activities(
  db: Connection,
  businessId?: string,
  venueIds?: string[],
): Promise<Activity[]> {
  const parameters: unknown[] = businessId ? [businessId] : [];
  let scope = businessId ? 'WHERE a.business_id=$1' : '';
  if (venueIds) {
    parameters.push(venueIds);
    scope += ` AND a.resource_id IN (SELECT o.offering_id::varchar FROM seven.offerings o WHERE o.venue_id=ANY($2::uuid[]) UNION SELECT r.reservation_id::varchar FROM seven.reservations r JOIN seven.offerings o USING(offering_id) WHERE o.venue_id=ANY($2::uuid[]) UNION SELECT p.payment_attempt_id::varchar FROM seven.payment_attempts p JOIN seven.reservations r USING(reservation_id) JOIN seven.offerings o USING(offering_id) WHERE o.venue_id=ANY($2::uuid[]))`;
  }
  return (
    await rows(
      db,
      `SELECT a.*,u.display_name FROM seven.audit_events a LEFT JOIN seven.users u USING(user_id) ${scope} ORDER BY a.created_at DESC LIMIT 100`,
      parameters,
    )
  ).map((r) => ({
    id: r.audit_event_id,
    action: r.action_code,
    actorName: r.display_name ?? '7even',
    entityType: r.action_code.split('.')[0],
    entityId: r.resource_id ?? '',
    createdAt: iso(r.created_at),
    detail: r.details.detail ?? '',
  }));
}
export async function metrics(
  db: Connection,
  businessId?: string,
  venueIds?: string[],
): Promise<Metrics> {
  const parameters: unknown[] = businessId ? [businessId] : [];
  if (venueIds) parameters.push(venueIds);
  const reservations = await rows(
    db,
    `${reservationSelect} ${businessId ? 'WHERE r.business_id=$1' : ''} ${venueIds ? 'AND o.venue_id=ANY($2::uuid[])' : ''}`,
    parameters,
  );
  const capacity = await one(
    db,
    `SELECT coalesce(sum(w.capacity-w.allocated_count),0) AS total FROM seven.inventory_windows w JOIN seven.offerings o USING(offering_id) WHERE ends_at>now() ${businessId ? 'AND business_id=$1' : ''} ${venueIds ? 'AND o.venue_id=ANY($2::uuid[])' : ''}`,
    parameters,
  );
  const paid = reservations.filter((r) => r.payment_code === 'PAID');
  const issued = await one(
    db,
    "SELECT coalesce(sum(p.points),0) AS total FROM seven.points_postings p JOIN seven.points_journals j USING(points_journal_id) WHERE p.points>0 AND p.account_code LIKE 'customer:%' AND j.source_reference=ANY($1::varchar[])",
    [reservations.map((r) => `earn:${r.reservation_id}`)],
  );
  const todayAt = (timezone: string): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    return ['year', 'month', 'day']
      .map((part) => parts.find((p) => p.type === part)?.value)
      .join('-');
  };
  return {
    totalReservations: reservations.length,
    confirmedReservations: reservations.filter((r) =>
      ['CONFIRMED', 'CHECKED_IN'].includes(r.state_code),
    ).length,
    arrivalsToday: reservations.filter(
      (r) =>
        r.terms_snapshot.startDate === todayAt(r.venue_timezone ?? 'Africa/Lagos') &&
        r.state_code === 'CONFIRMED',
    ).length,
    fulfilledReservations: reservations.filter((r) => r.state_code === 'FULFILLED').length,
    grossMinor: paid.reduce((sum, r) => sum + BigInt(r.amounts.totalMinor), 0n).toString(),
    commissionMinor: paid
      .reduce((sum, r) => sum + BigInt(r.amounts.commissionMinor), 0n)
      .toString(),
    availableCapacity: Number(capacity?.total ?? 0),
    pointsIssued: safePoints(issued?.total ?? '0'),
  };
}
export function requireTenant(actor: SessionUser, businessId: string, ownerOnly = false): void {
  if (actor.role === 'ADMIN') return;
  if (
    actor.businessId !== businessId ||
    !['BUSINESS_OWNER', 'RECEPTION'].includes(actor.role) ||
    (ownerOnly && actor.role !== 'BUSINESS_OWNER')
  )
    fail(403, 'FORBIDDEN', 'You do not have access to this business.');
}

export function requireVenue(actor: SessionUser, venueId: string): void {
  if (actor.role === 'RECEPTION' && !actor.venueIds.includes(venueId))
    fail(403, 'VENUE_FORBIDDEN', 'Your reception account does not have access to this venue.');
}
