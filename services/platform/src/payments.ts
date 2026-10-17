import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Checkout, Payment, SessionUser } from '@7even/contracts';
import { one, rows, fail, transaction } from './db.ts';
import type { Connection } from './db.ts';
import {
  sid,
  paymentProjection,
  reservationProjection,
  moneyJournal,
  pointsJournal,
  audit,
  notify,
  requireTenant,
} from './store.ts';
import { releaseAllocation, reservationAccess } from './reservations.ts';
import { decimalToMinor } from './provider.ts';
import type { PaymentProvider, ProviderReceipt, ProviderRefund } from './provider.ts';

export async function checkout(
  pool: Pool,
  provider: PaymentProvider,
  actor: SessionUser,
  reservationId: string,
  publicOrigin: string,
): Promise<Checkout> {
  const attempt = await transaction(pool, async (db) => {
    await one(
      db,
      'SELECT reservation_id FROM seven.reservations WHERE reservation_id=$1 FOR UPDATE',
      [reservationId],
    );
    const r = await reservationProjection(db, reservationId);
    if (!r) return fail(404, 'NOT_FOUND', 'Reservation not found.');
    await reservationAccess(db, actor, r);
    if (
      r.status !== 'HELD' ||
      !r.holdExpiresAt ||
      new Date(r.holdExpiresAt).getTime() - Date.now() < 60000
    )
      return fail(
        409,
        'HOLD_EXPIRED',
        'This hold is too close to expiry for a new checkout. Request a new quote.',
      );
    const previous = await one(
      db,
      'SELECT * FROM seven.payment_attempts WHERE reservation_id=$1 ORDER BY created_at DESC LIMIT 1',
      [reservationId],
    );
    if (previous) {
      if (previous.provider_details.mode !== provider.mode)
        return fail(
          409,
          'PROVIDER_MODE_CHANGED',
          'This checkout belongs to a different provider mode.',
        );
      return { row: previous, dispatch: false, customer: r };
    }
    const business = await one(
      db,
      `SELECT * FROM seven.businesses WHERE business_id=$1 AND workflow_state_id=${sid('APPROVED')}`,
      [r.businessId],
    );
    if (!business?.subaccount_id || business.details.subaccountMode !== provider.mode)
      return fail(
        409,
        'PAYMENTS_UNAVAILABLE',
        'This business is not ready to accept checkout payments in this provider mode.',
      );
    const id = randomUUID();
    const row = await one(
      db,
      `INSERT INTO seven.payment_attempts(payment_attempt_id,reservation_id,merchant_reference,workflow_state_id,settlement_state_id,currency_code,amount_minor,commission_minor,business_subaccount,bank_revision,provider_details) VALUES($1,$2,$3,${sid('PENDING')},${sid('UNSETTLED')},'NGN',$4,$5,$6,$7,$8) RETURNING *`,
      [
        id,
        reservationId,
        `seven-${id}`,
        r.price.totalMinor,
        r.price.commissionMinor,
        business.subaccount_id,
        business.bank_revision,
        {
          mode: provider.mode,
          checkoutDispatched: true,
          settlementAccount: business.details.settlementAccount ?? null,
          settlementBankCode: business.details.settlementBankCode ?? null,
        },
      ],
    );
    await db.query(
      `UPDATE seven.reservations SET payment_state_id=${sid('PENDING')},updated_at=now() WHERE reservation_id=$1`,
      [reservationId],
    );
    await audit(db, actor, r.businessId, 'payment.checkout_requested', id);
    return { row: row!, dispatch: true, customer: r };
  });
  if (attempt.dispatch) {
    try {
      const link =
        provider.mode === 'mock'
          ? `/checkout/test/${attempt.row.payment_attempt_id}`
          : await provider.checkout({
              reference: attempt.row.merchant_reference,
              amountMinor: Number(attempt.row.amount_minor),
              commissionMinor: Number(attempt.row.commission_minor),
              currency: 'NGN',
              subaccountId: attempt.row.business_subaccount,
              email: attempt.customer.customerEmail ?? actor.email,
              displayName: attempt.customer.customerName,
              expiresAt: attempt.customer.holdExpiresAt!,
              redirectUrl: `${publicOrigin}/payment/return?reference=${encodeURIComponent(attempt.row.merchant_reference)}`,
            });
      await pool.query(
        'UPDATE seven.payment_attempts SET checkout_url=$1,updated_at=now() WHERE payment_attempt_id=$2',
        [link, attempt.row.payment_attempt_id],
      );
      attempt.row.checkout_url = link;
    } catch {
      await pool.query(
        `UPDATE seven.payment_attempts SET workflow_state_id=${sid('UNKNOWN')},updated_at=now() WHERE payment_attempt_id=$1`,
        [attempt.row.payment_attempt_id],
      );
      return fail(
        503,
        'PAYMENT_UNKNOWN',
        'Checkout could not be confirmed. Review this payment before starting another attempt.',
      );
    }
  }
  if (!attempt.row.checkout_url)
    return fail(
      409,
      'PAYMENT_PENDING',
      'This checkout is being reconciled. Please check its status.',
    );
  return {
    paymentId: attempt.row.payment_attempt_id,
    reference: attempt.row.merchant_reference,
    checkoutUrl: attempt.row.checkout_url,
    mode: provider.mode,
  };
}

export async function applyReceipt(
  db: Connection,
  receipt: ProviderReceipt,
  actor: SessionUser | null = null,
): Promise<Payment> {
  const p = await one(
    db,
    'SELECT * FROM seven.payment_attempts WHERE merchant_reference=$1 FOR UPDATE',
    [receipt.reference],
  );
  if (!p) return fail(404, 'PAYMENT_NOT_FOUND', 'The payment reference is not recognized.');
  if (receipt.status !== 'successful') {
    if (!p.provider_transaction_id && receipt.status === 'failed') {
      await db.query(
        `UPDATE seven.payment_attempts SET workflow_state_id=${sid('FAILED')},updated_at=now() WHERE payment_attempt_id=$1`,
        [p.payment_attempt_id],
      );
      await db.query(
        `UPDATE seven.reservations SET payment_state_id=${sid('FAILED')},updated_at=now() WHERE reservation_id=$1 AND payment_state_id<>${sid('PAID')}`,
        [p.reservation_id],
      );
    }
    return (await paymentProjection(db, p.payment_attempt_id))!;
  }
  const existing = await one(
    db,
    'SELECT * FROM seven.payment_attempts WHERE provider_transaction_id=$1',
    [receipt.id],
  );
  if (existing) {
    const original = existing.payment_attempt_id === p.payment_attempt_id;
    const recordedExcess =
      existing.reservation_id === p.reservation_id &&
      existing.provider_details.originalReference === receipt.reference;
    if (!original && !recordedExcess)
      return fail(
        409,
        'PAYMENT_REUSED',
        'This provider transaction is already attached to another payment.',
      );
    if (
      String(receipt.amountMinor) !==
        String(existing.provider_details.actualAmountMinor ?? existing.amount_minor) ||
      receipt.currency !== (existing.provider_details.actualCurrency ?? existing.currency_code)
    )
      return fail(
        409,
        'PAYMENT_MISMATCH',
        'The provider changed the amount or currency of an already recorded receipt. Review this payment.',
      );
    return (await paymentProjection(db, existing.payment_attempt_id))!;
  }
  await one(
    db,
    'SELECT reservation_id FROM seven.reservations WHERE reservation_id=$1 FOR UPDATE',
    [p.reservation_id],
  );
  const r = (await reservationProjection(db, p.reservation_id))!;
  if (p.provider_transaction_id) {
    const duplicateId = randomUUID();
    await db.query(
      `INSERT INTO seven.payment_attempts(payment_attempt_id,reservation_id,merchant_reference,provider_transaction_id,workflow_state_id,settlement_state_id,currency_code,amount_minor,commission_minor,business_subaccount,bank_revision,provider_details) VALUES($1,$2,$3,$4,${sid('REVIEW_REQUIRED')},${sid('UNSETTLED')},$5,$6,0,$7,$8,$9)`,
      [
        duplicateId,
        p.reservation_id,
        `${receipt.reference}:duplicate:${duplicateId}`,
        receipt.id,
        receipt.currency,
        receipt.amountMinor,
        p.business_subaccount,
        p.bank_revision,
        {
          mode: p.provider_details.mode,
          originalReference: receipt.reference,
          verifiedAt: new Date().toISOString(),
          feeMinor: String(receipt.feeMinor),
          exception: 'Duplicate successful customer charge',
        },
      ],
    );
    if (receipt.currency === 'NGN')
      await moneyJournal(db, `receipt:${receipt.id}`, 'Duplicate customer charge requires review', [
        { account: 'provider-clearing', amount: String(receipt.amountMinor) },
        { account: `unallocated:${duplicateId}`, amount: String(-receipt.amountMinor) },
      ]);
    await audit(db, actor, r.businessId, 'payment.duplicate_charge', duplicateId);
    return (await paymentProjection(db, duplicateId))!;
  }
  const matched =
    receipt.currency === p.currency_code && String(receipt.amountMinor) === p.amount_minor;
  const live =
    r.status === 'HELD' && r.holdExpiresAt !== null && new Date(r.holdExpiresAt) > new Date();
  const valid = matched && live;
  await db.query(
    `UPDATE seven.payment_attempts SET provider_transaction_id=$2,workflow_state_id=${sid(matched ? 'PAID' : 'REVIEW_REQUIRED')},provider_details=provider_details||$3::jsonb,updated_at=now() WHERE payment_attempt_id=$1`,
    [
      p.payment_attempt_id,
      receipt.id,
      JSON.stringify({
        verifiedAt: new Date().toISOString(),
        feeMinor: String(receipt.feeMinor),
        actualAmountMinor: String(receipt.amountMinor),
        actualCurrency: receipt.currency,
        ...(!matched ? { exception: 'Verified receipt does not match immutable quote' } : {}),
      }),
    ],
  );
  if (receipt.currency === 'NGN') {
    const amount = BigInt(receipt.amountMinor);
    const commission = matched ? BigInt(p.commission_minor) : 0n;
    await moneyJournal(db, `receipt:${receipt.id}`, 'Provider-verified hospitality payment', [
      { account: 'provider-clearing', amount: amount.toString() },
      {
        account: matched ? `business:${r.businessId}` : `unallocated:${p.payment_attempt_id}`,
        amount: (-amount + commission).toString(),
      },
      { account: 'platform-commission', amount: (-commission).toString() },
    ]);
    if (receipt.feeMinor)
      await moneyJournal(db, `fee:${receipt.id}`, 'Provider fee borne by merchant', [
        { account: 'provider-clearing', amount: String(-receipt.feeMinor) },
        {
          account: matched ? `business:${r.businessId}` : `unallocated:${p.payment_attempt_id}`,
          amount: String(receipt.feeMinor),
        },
      ]);
  }
  if (!valid) await releaseAllocation(db, r.id);
  await db.query(
    `UPDATE seven.reservations SET workflow_state_id=${sid(valid ? 'CONFIRMED' : 'PAYMENT_REVIEW')},payment_state_id=${sid(matched ? 'PAID' : 'REVIEW_REQUIRED')},funding_payment_attempt_id=$2,revision=revision+1,updated_at=now() WHERE reservation_id=$1`,
    [r.id, p.payment_attempt_id],
  );
  await audit(
    db,
    actor,
    r.businessId,
    valid ? 'payment.verified' : 'payment.review_required',
    p.payment_attempt_id,
  );
  await notify(
    db,
    r.customerId,
    valid ? 'Payment confirmed' : 'Your payment needs review',
    valid
      ? 'Your reservation is confirmed. Bank settlement is tracked separately.'
      : 'We received a payment record but could not allocate this reservation. The team must review it.',
  );
  return (await paymentProjection(db, p.payment_attempt_id))!;
}

export async function verifyPayment(
  pool: Pool,
  provider: PaymentProvider,
  actor: SessionUser | null,
  reference: string,
  transactionId?: string,
): Promise<Payment> {
  const p = await one(
    pool,
    'SELECT payment_attempt_id,reservation_id,provider_details FROM seven.payment_attempts WHERE merchant_reference=$1',
    [reference],
  );
  if (!p) return fail(404, 'NOT_FOUND', 'Payment not found.');
  if (p.provider_details.mode !== provider.mode)
    return fail(409, 'PROVIDER_MODE_CHANGED', 'This payment belongs to a different provider mode.');
  if (actor)
    await reservationAccess(pool, actor, (await reservationProjection(pool, p.reservation_id))!);
  const receipt = await provider.verify(reference, transactionId);
  if (transactionId && receipt.id !== transactionId)
    return fail(
      409,
      'PAYMENT_MISMATCH',
      'The provider transaction identity does not match the request.',
    );
  if (receipt.reference !== reference)
    return fail(409, 'PAYMENT_MISMATCH', 'The provider reference does not match this checkout.');
  return transaction(pool, (db) => applyReceipt(db, receipt, actor));
}

async function applyRefund(
  db: Connection,
  refundId: string,
  result: ProviderRefund,
): Promise<void> {
  const refund = await one(
    db,
    'SELECT r.*,s.workflow_state_code FROM seven.refunds r JOIN seven.workflow_states s USING(workflow_state_id) WHERE refund_id=$1 FOR UPDATE OF r',
    [refundId],
  );
  if (!refund) throw new Error('Refund intent not found.');
  if (refund.workflow_state_code === 'DELIVERED') {
    if (
      ![
        'completed-bank-transfer',
        'completed-momo',
        'completed-mpgs',
        'completed-offline',
        'completed-preauth',
      ].includes(result.status)
    )
      await db.query(
        'UPDATE seven.refunds SET provider_details=provider_details||$2::jsonb WHERE refund_id=$1',
        [
          refundId,
          JSON.stringify({
            exception:
              'A later provider observation contradicts confirmed refund delivery. Review without repeating the refund.',
          }),
        ],
      );
    return;
  }
  if (
    !result.id ||
    (refund.provider_refund_id && refund.provider_refund_id !== result.id) ||
    result.amountMinor !== Number(refund.amount_minor)
  ) {
    await db.query(
      `UPDATE seven.refunds SET workflow_state_id=${sid('UNKNOWN')},provider_details=$2,updated_at=now() WHERE refund_id=$1`,
      [
        refundId,
        {
          exception: 'Provider refund identity or amount does not match the stored refund intent.',
        },
      ],
    );
    return;
  }
  const delivered = [
    'completed-bank-transfer',
    'completed-momo',
    'completed-mpgs',
    'completed-offline',
    'completed-preauth',
  ].includes(result.status);
  const failed = result.status === 'failed';
  await db.query(
    `UPDATE seven.refunds SET provider_refund_id=$2,workflow_state_id=${sid(delivered ? 'DELIVERED' : failed ? 'FAILED' : 'INITIATED')},provider_details=$3,updated_at=now() WHERE refund_id=$1`,
    [refundId, result.id, { providerStatus: result.status }],
  );
  if (!delivered) return;
  const p = (await one(
    db,
    'SELECT * FROM seven.payment_attempts WHERE payment_attempt_id=$1 FOR UPDATE',
    [refund.payment_attempt_id],
  ))!;
  const r = (await reservationProjection(db, p.reservation_id))!;
  const originalPostings = await rows(
    db,
    'SELECT mp.account_code,mp.amount_minor FROM seven.money_postings mp JOIN seven.money_journals j USING(money_journal_id) WHERE j.source_reference=$1',
    [`receipt:${p.provider_transaction_id}`],
  );
  if (!originalPostings.length)
    return fail(
      409,
      'REFUND_REVIEW',
      'The original receipt allocation must be reconciled before refund accounting.',
    );
  await moneyJournal(
    db,
    `refund:${refundId}`,
    'Confirmed customer refund; original receipt allocation reversed, fees tracked separately',
    originalPostings.map((posting) => ({
      account: posting.account_code,
      amount: (-BigInt(posting.amount_minor)).toString(),
    })),
  );
  const earned =
    r.paymentId === p.payment_attempt_id
      ? await one(
          db,
          'SELECT coalesce(sum(p.points),0) AS total FROM seven.points_postings p JOIN seven.points_journals j USING(points_journal_id) WHERE j.source_reference=$1 AND p.account_code=$2',
          [`earn:${r.id}`, `customer:${r.customerId}`],
        )
      : undefined;
  await db.query('SELECT user_id FROM seven.users WHERE user_id=$1 FOR UPDATE', [r.customerId]);
  const points = Number(earned?.total ?? 0);
  if (points)
    await pointsJournal(db, `reversal:${r.id}`, 'Points reversed after refund', [
      { account: `customer:${r.customerId}`, amount: -points },
      { account: 'issuer', amount: points },
    ]);
  await db.query(
    `UPDATE seven.payment_attempts SET workflow_state_id=${sid('REFUNDED')},updated_at=now() WHERE payment_attempt_id=$1`,
    [p.payment_attempt_id],
  );
  if (r.paymentId === p.payment_attempt_id)
    await db.query(
      `UPDATE seven.reservations SET payment_state_id=${sid('REFUNDED')},updated_at=now() WHERE reservation_id=$1`,
      [r.id],
    );
}

export async function requestRefund(
  pool: Pool,
  provider: PaymentProvider,
  actor: SessionUser,
  reservationId: string,
  reason: string,
  specifiedPaymentId?: string,
): Promise<Payment> {
  const intent = await transaction(pool, async (db) => {
    await one(
      db,
      'SELECT reservation_id FROM seven.reservations WHERE reservation_id=$1 FOR UPDATE',
      [reservationId],
    );
    const r = await reservationProjection(db, reservationId);
    if (!r) return fail(404, 'NOT_FOUND', 'Reservation not found.');
    requireTenant(actor, r.businessId, true);
    const chosenPaymentId = specifiedPaymentId ?? r.paymentId;
    const p = chosenPaymentId
      ? await one(
          db,
          'SELECT * FROM seven.payment_attempts WHERE payment_attempt_id=$1 AND reservation_id=$2 FOR UPDATE',
          [chosenPaymentId, r.id],
        )
      : null;
    const isFundingPayment = chosenPaymentId === r.paymentId;
    if (isFundingPayment && !['CANCELLED', 'PAYMENT_REVIEW', 'FULFILLED'].includes(r.status))
      return fail(
        409,
        'CANCEL_FIRST',
        'Cancel or resolve the reservation before requesting a refund. A completed-service refund preserves its fulfilment history.',
      );
    if (!p?.provider_transaction_id)
      return fail(409, 'PAYMENT_UNVERIFIED', 'There is no verified provider charge to refund.');
    if (p.provider_details.mode !== provider.mode)
      return fail(
        409,
        'PROVIDER_MODE_CHANGED',
        'This payment belongs to a different provider mode.',
      );
    if (p.provider_details.actualCurrency && p.provider_details.actualCurrency !== 'NGN')
      return fail(
        409,
        'REFUND_REVIEW',
        'An unexpected payment currency needs provider review before a refund.',
      );
    const previous = await one(
      db,
      'SELECT * FROM seven.refunds WHERE payment_attempt_id=$1 ORDER BY created_at LIMIT 1',
      [p.payment_attempt_id],
    );
    if (previous) return { refund: previous, payment: p, dispatch: false };
    if (
      !['PAID', 'REVIEW_REQUIRED'].includes(
        (await paymentProjection(db, p.payment_attempt_id))!.status,
      )
    )
      return fail(409, 'REFUND_UNAVAILABLE', 'This payment cannot be refunded automatically.');
    const id = randomUUID();
    const refund = (await one(
      db,
      `INSERT INTO seven.refunds(refund_id,payment_attempt_id,amount_minor,workflow_state_id,reason,operation_reference) VALUES($1,$2,$3,${sid('DISPATCHED')},$4,$5) RETURNING *`,
      [
        id,
        p.payment_attempt_id,
        p.provider_details.actualAmountMinor ?? p.amount_minor,
        reason,
        `refund:${p.payment_attempt_id}`,
      ],
    ))!;
    await db.query(
      `UPDATE seven.payment_attempts SET workflow_state_id=${sid('REFUND_PENDING')},updated_at=now() WHERE payment_attempt_id=$1`,
      [p.payment_attempt_id],
    );
    if (isFundingPayment)
      await db.query(
        `UPDATE seven.reservations SET payment_state_id=${sid('REFUND_PENDING')},updated_at=now() WHERE reservation_id=$1`,
        [reservationId],
      );
    await audit(db, actor, r.businessId, 'refund.dispatched', id, reason);
    return { refund, payment: p, dispatch: true };
  });
  if (intent.dispatch) {
    try {
      const result = await provider.refund(
        intent.payment.provider_transaction_id,
        Number(intent.refund.amount_minor),
        reason,
      );
      await transaction(pool, (db) => applyRefund(db, intent.refund.refund_id, result));
    } catch {
      await pool.query(
        `UPDATE seven.refunds SET workflow_state_id=${sid('UNKNOWN')},provider_details=$2,updated_at=now() WHERE refund_id=$1`,
        [
          intent.refund.refund_id,
          { exception: 'Provider outcome unknown. Reconcile before another financial request.' },
        ],
      );
    }
  }
  return (await paymentProjection(pool, intent.payment.payment_attempt_id))!;
}

export async function reconcile(
  pool: Pool,
  provider: PaymentProvider,
): Promise<{ processed: number; pending: number; exceptions: number }> {
  let processed = 0;
  let exceptions = 0;
  const pending = await rows(
    pool,
    `SELECT p.* FROM seven.payment_attempts p WHERE workflow_state_id IN (${sid('PENDING')},${sid('UNKNOWN')}) ORDER BY created_at LIMIT 25`,
  );
  for (const p of pending) {
    try {
      await verifyPayment(
        pool,
        provider,
        null,
        p.merchant_reference,
        p.provider_transaction_id ?? undefined,
      );
      processed++;
    } catch {
      exceptions++;
    }
  }
  const refunds = await rows(
    pool,
    `SELECT * FROM seven.refunds WHERE workflow_state_id IN (${sid('INITIATED')},${sid('UNKNOWN')}) ORDER BY created_at LIMIT 25`,
  );
  for (const r of refunds) {
    if (!r.provider_refund_id) {
      exceptions++;
      continue;
    }
    try {
      const result = await provider.refundStatus(r.provider_refund_id);
      await transaction(pool, (db) => applyRefund(db, r.refund_id, result));
      processed++;
    } catch {
      exceptions++;
    }
  }
  const settlement = await reconcileSettlements(pool, provider);
  processed += settlement.processed;
  exceptions += settlement.exceptions;
  return {
    processed,
    pending: Math.max(0, pending.length + refunds.length - processed) + settlement.pending,
    exceptions,
  };
}

/** v3 settlement detail contract: documented transactions[] and exact business bank snapshot. */
export async function reconcileSettlements(
  pool: Pool,
  provider: PaymentProvider,
): Promise<{ processed: number; pending: number; exceptions: number }> {
  if (provider.mode === 'mock') return { processed: 0, pending: 0, exceptions: 0 };
  const attempts = await rows(
    pool,
    `SELECT p.*,r.business_id FROM seven.payment_attempts p JOIN seven.reservations r USING(reservation_id) WHERE p.workflow_state_id=${sid('PAID')} AND p.provider_details->>'mode'=$1 AND p.settlement_state_id<>${sid('SETTLED')} AND p.settlement_checks<12 AND p.next_settlement_check_at<=now() ORDER BY p.created_at LIMIT 25`,
    [provider.mode],
  );
  let processed = 0;
  let exceptions = 0;
  const subaccounts = [...new Set(attempts.map((p) => String(p.business_subaccount)))].slice(0, 3);
  for (const subaccount of subaccounts) {
    const claimed: typeof attempts = [];
    for (const attempt of attempts.filter((p) => p.business_subaccount === subaccount)) {
      const claim = await one(
        pool,
        "UPDATE seven.payment_attempts SET settlement_checks=settlement_checks+1,next_settlement_check_at=now()+interval '15 minutes' WHERE payment_attempt_id=$1 AND settlement_checks<12 AND next_settlement_check_at<=now() RETURNING payment_attempt_id",
        [attempt.payment_attempt_id],
      );
      if (claim) claimed.push(attempt);
    }
    if (!claimed.length) continue;
    let settlements: Record<string, unknown>[];
    try {
      settlements = await provider.settlements(subaccount);
    } catch {
      exceptions++;
      await pool.query(
        `UPDATE seven.payment_attempts SET settlement_state_id=CASE WHEN settlement_checks>=12 THEN ${sid('FLAGGED')} ELSE ${sid('PENDING')} END,provider_details=provider_details||$2::jsonb WHERE payment_attempt_id=ANY($1::uuid[])`,
        [
          claimed.map((attempt) => attempt.payment_attempt_id),
          JSON.stringify({
            settlementException:
              'Provider settlement lookup failed. Bounded retries preserve this record for operational review.',
          }),
        ],
      );
      continue;
    }
    for (const attempt of claimed) {
      let matched = false;
      for (const settlement of settlements) {
        if (!Array.isArray(settlement.transactions)) continue;
        const entry = settlement.transactions.find(
          (item: unknown) =>
            item &&
            typeof item === 'object' &&
            String((item as Record<string, unknown>).id) ===
              String(attempt.provider_transaction_id),
        );
        if (!entry) continue;
        matched = true;
        const transactionData = entry as Record<string, unknown>;
        try {
          if (
            String(transactionData.tx_ref) !== attempt.merchant_reference ||
            String(transactionData.currency) !== 'NGN' ||
            String(settlement.currency) !== 'NGN' ||
            String(settlement.queriedSubaccount) !== subaccount
          )
            throw new Error('Settlement identity mismatch.');
          if (
            !attempt.provider_details.settlementAccount ||
            String(settlement.settlement_account) !== attempt.provider_details.settlementAccount ||
            String(settlement.bank_code) !== attempt.provider_details.settlementBankCode ||
            !['account', 'bank_account', 'bank'].includes(String(settlement.destination))
          )
            throw new Error(
              'Settlement bank destination does not match the approved immutable mapping.',
            );
          if (String(settlement.status) !== 'completed') {
            await pool.query(
              `UPDATE seven.payment_attempts SET settlement_state_id=${sid(String(settlement.status) === 'flagged' ? 'FLAGGED' : 'PENDING')},provider_details=provider_details||$2::jsonb WHERE payment_attempt_id=$1`,
              [
                attempt.payment_attempt_id,
                JSON.stringify({
                  settlementReference: String(settlement.id),
                  settlementProviderStatus: String(settlement.status),
                }),
              ],
            );
            if (String(settlement.status) === 'flagged') exceptions++;
            continue;
          }
          if (
            !settlement.disburse_ref ||
            !settlement.processed_date ||
            String(transactionData.status) !== 'successful'
          )
            throw new Error('Settlement delivery evidence is incomplete.');
          const fee =
            decimalToMinor(transactionData.app_fee ?? 0) +
            decimalToMinor(transactionData.merchant_fee ?? 0) +
            decimalToMinor(transactionData.stampduty_charge ?? 0);
          const net = decimalToMinor(transactionData.settlement_amount);
          const expected =
            BigInt(attempt.amount_minor) - BigInt(attempt.commission_minor) - BigInt(fee);
          if (expected < 0n || BigInt(net) !== expected)
            throw new Error('Settlement net/commission/fee allocation does not reconcile.');
          await transaction(pool, async (db) => {
            const locked = await one(
              db,
              `SELECT * FROM seven.payment_attempts WHERE payment_attempt_id=$1 FOR UPDATE`,
              [attempt.payment_attempt_id],
            );
            if (
              !locked ||
              locked.settlement_state_id ===
                (
                  await one(
                    db,
                    `SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='SETTLED'`,
                  )
                )?.workflow_state_id
            )
              return;
            const adjustment = BigInt(fee) - BigInt(locked.provider_details.feeMinor ?? 0);
            if (adjustment !== 0n)
              await moneyJournal(
                db,
                `settlement-fee:${attempt.payment_attempt_id}`,
                'Actual provider settlement fees borne by business',
                [
                  { account: 'provider-clearing', amount: (-adjustment).toString() },
                  { account: `business:${attempt.business_id}`, amount: adjustment.toString() },
                ],
              );
            await moneyJournal(
              db,
              `settlement:${String(settlement.id)}:${attempt.payment_attempt_id}`,
              'Provider-confirmed settlement to approved business bank',
              [
                { account: 'provider-clearing', amount: String(-net) },
                { account: `business:${attempt.business_id}`, amount: String(net) },
              ],
            );
            await db.query(
              `UPDATE seven.payment_attempts SET settlement_state_id=${sid('SETTLED')},provider_details=provider_details||$2::jsonb,updated_at=now() WHERE payment_attempt_id=$1`,
              [
                attempt.payment_attempt_id,
                JSON.stringify({
                  feeMinor: String(fee),
                  settlementId: String(settlement.id),
                  settlementReference: String(settlement.disburse_ref),
                  settledAt: String(settlement.processed_date),
                  settlementException: null,
                }),
              ],
            );
            await audit(
              db,
              null,
              attempt.business_id,
              'payment.bank_settled',
              attempt.payment_attempt_id,
            );
          });
          processed++;
        } catch (error) {
          exceptions++;
          await pool.query(
            `UPDATE seven.payment_attempts SET settlement_state_id=${sid('FLAGGED')},provider_details=provider_details||$2::jsonb WHERE payment_attempt_id=$1`,
            [
              attempt.payment_attempt_id,
              JSON.stringify({
                settlementException:
                  error instanceof Error ? error.message : 'Settlement requires review.',
              }),
            ],
          );
        }
        break;
      }
      if (!matched)
        await pool.query(
          `UPDATE seven.payment_attempts SET settlement_state_id=${sid('PENDING')},provider_details=provider_details||$2::jsonb WHERE payment_attempt_id=$1`,
          [
            attempt.payment_attempt_id,
            JSON.stringify({
              settlementException:
                'Provider has not supplied matching per-transaction bank-settlement evidence.',
            }),
          ],
        );
    }
  }
  return { processed, pending: attempts.length - processed, exceptions };
}
