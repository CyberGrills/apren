import { randomUUID } from 'node:crypto';
import type { Benefit, SessionUser, Trade } from '@7even/contracts';
import type { Connection } from './db.ts';
import { one, rows, fail } from './db.ts';
import {
  benefitProjection,
  pointsProjection,
  pointsJournal,
  tradeProjection,
  sid,
  audit,
  notify,
  requireTenant,
} from './store.ts';

export async function redeem(
  db: Connection,
  actor: SessionUser,
  rewardId: string,
): Promise<Benefit> {
  if (actor.role !== 'CUSTOMER')
    return fail(403, 'CUSTOMER_REQUIRED', 'Use a customer account to redeem rewards.');
  await db.query('SELECT user_id FROM seven.users WHERE user_id=$1 FOR UPDATE', [actor.id]);
  const reward = await one(
    db,
    `SELECT r.* FROM seven.rewards r JOIN seven.businesses b USING(business_id) WHERE reward_id=$1 AND r.is_published AND b.workflow_state_id=${sid('APPROVED')} FOR UPDATE OF r`,
    [rewardId],
  );
  if (!reward || new Date(reward.expires_at) <= new Date() || reward.remaining_count < 1)
    return fail(409, 'REWARD_UNAVAILABLE', 'This reward is no longer available.');
  const points = await pointsProjection(db, actor.id);
  if (points.available < reward.points_cost || points.shortfall > 0)
    return fail(
      409,
      'INSUFFICIENT_POINTS',
      'You do not have enough available points for this reward.',
    );
  const id = randomUUID();
  await pointsJournal(db, `redeem:${id}`, `Redeemed ${reward.title}`, [
    { account: `customer:${actor.id}`, amount: -reward.points_cost },
    { account: `redemption:${reward.business_id}`, amount: reward.points_cost },
  ]);
  await db.query(
    'UPDATE seven.rewards SET remaining_count=remaining_count-1,revision=revision+1,updated_at=now() WHERE reward_id=$1',
    [rewardId],
  );
  await db.query(
    `INSERT INTO seven.entitlements(entitlement_id,user_id,business_id,reward_id,workflow_state_id,expires_at,is_transferable,redemption_code,source_reference) VALUES($1,$2,$3,$4,${sid('AVAILABLE')},$5,$6,$7,$8)`,
    [
      id,
      actor.id,
      reward.business_id,
      rewardId,
      reward.expires_at,
      reward.is_transferable,
      randomUUID().replaceAll('-', ''),
      `redeem:${id}`,
    ],
  );
  await audit(db, actor, reward.business_id, 'benefit.redeemed', id);
  return (await benefitProjection(db, id))!;
}
export async function consume(
  db: Connection,
  actor: SessionUser,
  id: string,
  code: string,
  revision: number,
): Promise<Benefit> {
  await db.query(
    'SELECT entitlement_id FROM seven.entitlements WHERE entitlement_id=$1 FOR UPDATE',
    [id],
  );
  const benefit = await benefitProjection(db, id);
  if (!benefit) return fail(404, 'NOT_FOUND', 'Benefit not found.');
  requireTenant(actor, benefit.businessId);
  if (benefit.redemptionCode !== code || benefit.revision !== revision)
    return fail(409, 'REVISION_CONFLICT', 'The benefit code or revision has changed.');
  if (benefit.status !== 'AVAILABLE')
    return fail(409, 'BENEFIT_UNAVAILABLE', 'This benefit cannot be used now.');
  await db.query(
    `UPDATE seven.entitlements SET workflow_state_id=${sid('CONSUMED')},revision=revision+1,updated_at=now() WHERE entitlement_id=$1`,
    [id],
  );
  await audit(db, actor, benefit.businessId, 'benefit.consumed', id);
  await notify(
    db,
    benefit.ownerId,
    'Benefit used',
    `${benefit.title} has been used at ${benefit.businessName}.`,
    '/app/benefits',
  );
  return (await benefitProjection(db, id))!;
}
export async function expireTrades(db: Connection): Promise<void> {
  const expired = await rows(
    db,
    `SELECT * FROM seven.exchanges WHERE workflow_state_id=${sid('PENDING')} AND expires_at<=now() ORDER BY exchange_id FOR UPDATE SKIP LOCKED LIMIT 100`,
  );
  for (const trade of expired) {
    const ids = [trade.entitlement_id, trade.desired_entitlement_id].filter(Boolean).sort();
    for (const id of ids)
      await db.query(
        'UPDATE seven.entitlements SET is_locked=false,revision=revision+1,updated_at=now() WHERE entitlement_id=$1',
        [id],
      );
    await db.query(
      `UPDATE seven.exchanges SET workflow_state_id=${sid('EXPIRED')},revision=revision+1,updated_at=now() WHERE exchange_id=$1`,
      [trade.exchange_id],
    );
  }
}
export async function proposeTrade(
  db: Connection,
  actor: SessionUser,
  input: { benefitId: string; recipientEmail: string; requestedBenefitId?: string },
): Promise<Trade> {
  await expireTrades(db);
  const recipient = await one(db, 'SELECT user_id FROM seven.users WHERE email=$1 AND is_active', [
    input.recipientEmail,
  ]);
  if (!recipient || recipient.user_id === actor.id)
    return fail(422, 'INVALID_RECIPIENT', 'Choose another registered customer.');
  for (const id of [input.benefitId, input.requestedBenefitId]
    .filter((id): id is string => !!id)
    .sort())
    await db.query(
      'SELECT entitlement_id FROM seven.entitlements WHERE entitlement_id=$1 FOR UPDATE',
      [id],
    );
  const benefit = await benefitProjection(db, input.benefitId);
  if (
    !benefit ||
    benefit.ownerId !== actor.id ||
    !benefit.transferable ||
    benefit.status !== 'AVAILABLE'
  )
    return fail(
      409,
      'BENEFIT_UNAVAILABLE',
      'You can only exchange your available transferable benefits.',
    );
  if (input.requestedBenefitId) {
    const desired = await benefitProjection(db, input.requestedBenefitId);
    if (
      !desired ||
      desired.ownerId !== recipient.user_id ||
      !desired.transferable ||
      desired.status !== 'AVAILABLE'
    )
      return fail(409, 'BENEFIT_UNAVAILABLE', 'The requested benefit is not available for a swap.');
  }
  const id = randomUUID();
  await db.query(
    `INSERT INTO seven.exchanges(exchange_id,proposer_user_id,recipient_user_id,entitlement_id,desired_entitlement_id,exchange_kind_id,workflow_state_id,expires_at) VALUES($1,$2,$3,$4,$5,(SELECT exchange_kind_id FROM seven.exchange_kinds WHERE exchange_kind_code=$6),${sid('PENDING')},LEAST(now()+interval '24 hours',$7::timestamptz))`,
    [
      id,
      actor.id,
      recipient.user_id,
      input.benefitId,
      input.requestedBenefitId ?? null,
      input.requestedBenefitId ? 'SWAP' : 'GIFT',
      benefit.expiresAt,
    ],
  );
  for (const benefitId of [input.benefitId, input.requestedBenefitId].filter(Boolean))
    await db.query(
      'UPDATE seven.entitlements SET is_locked=true,revision=revision+1,updated_at=now() WHERE entitlement_id=$1',
      [benefitId],
    );
  await audit(db, actor, benefit.businessId, 'trade.proposed', id);
  await notify(
    db,
    recipient.user_id,
    input.requestedBenefitId ? 'A swap invitation' : 'A benefit has been offered to you',
    `${actor.displayName} sent you ${benefit.title}. Review it in your account.`,
    '/app/exchange',
  );
  return (await tradeProjection(db, id))!;
}
export async function actTrade(
  db: Connection,
  actor: SessionUser,
  id: string,
  action: 'ACCEPT' | 'DECLINE' | 'CANCEL',
  revision: number,
): Promise<Trade> {
  const row = await one(
    db,
    `SELECT r.*, (SELECT workflow_state_code FROM seven.workflow_states s WHERE s.workflow_state_id=r.workflow_state_id) AS state_code FROM seven.exchanges r WHERE exchange_id=$1 FOR UPDATE`,
    [id],
  );
  if (!row) return fail(404, 'NOT_FOUND', 'Invitation not found.');
  if (
    (action === 'CANCEL' && row.proposer_user_id !== actor.id) ||
    (action !== 'CANCEL' && row.recipient_user_id !== actor.id)
  )
    return fail(403, 'FORBIDDEN', 'Only the named person can take this action.');
  if (
    row.revision !== revision ||
    row.state_code !== 'PENDING' ||
    new Date(row.expires_at) <= new Date()
  )
    return fail(409, 'REVISION_CONFLICT', 'This invitation has changed or expired.');
  for (const benefitId of [row.entitlement_id, row.desired_entitlement_id].filter(Boolean).sort())
    await db.query(
      'SELECT entitlement_id FROM seven.entitlements WHERE entitlement_id=$1 FOR UPDATE',
      [benefitId],
    );
  const source = await benefitProjection(db, row.entitlement_id);
  const desired = row.desired_entitlement_id
    ? await benefitProjection(db, row.desired_entitlement_id)
    : null;
  if (
    !source ||
    source.ownerId !== row.proposer_user_id ||
    new Date(source.expiresAt) <= new Date() ||
    source.status !== 'LOCKED' ||
    (desired &&
      (desired.ownerId !== row.recipient_user_id ||
        desired.status !== 'LOCKED' ||
        new Date(desired.expiresAt) <= new Date()))
  )
    return fail(409, 'BENEFIT_UNAVAILABLE', 'A benefit in this invitation is no longer available.');
  if (action === 'ACCEPT') {
    await db.query(
      'UPDATE seven.entitlements SET user_id=$2,is_locked=false,redemption_code=$3,revision=revision+1,updated_at=now() WHERE entitlement_id=$1',
      [row.entitlement_id, row.recipient_user_id, randomUUID().replaceAll('-', '')],
    );
    if (desired)
      await db.query(
        'UPDATE seven.entitlements SET user_id=$2,is_locked=false,redemption_code=$3,revision=revision+1,updated_at=now() WHERE entitlement_id=$1',
        [row.desired_entitlement_id, row.proposer_user_id, randomUUID().replaceAll('-', '')],
      );
  } else {
    for (const benefitId of [row.entitlement_id, row.desired_entitlement_id].filter(Boolean))
      await db.query(
        'UPDATE seven.entitlements SET is_locked=false,revision=revision+1,updated_at=now() WHERE entitlement_id=$1',
        [benefitId],
      );
  }
  await db.query(
    `UPDATE seven.exchanges SET workflow_state_id=${sid(action === 'ACCEPT' ? 'ACCEPTED' : action === 'DECLINE' ? 'DECLINED' : 'CANCELLED')},revision=revision+1,updated_at=now() WHERE exchange_id=$1`,
    [id],
  );
  await audit(db, actor, source.businessId, `trade.${action.toLowerCase()}`, id);
  await notify(
    db,
    action === 'CANCEL' ? row.recipient_user_id : row.proposer_user_id,
    action === 'ACCEPT'
      ? 'Invitation accepted'
      : action === 'DECLINE'
        ? 'Invitation declined'
        : 'Invitation cancelled',
    'Review the current benefit ownership in your exchange history.',
    '/app/exchange',
  );
  return (await tradeProjection(db, id))!;
}
