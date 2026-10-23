import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  Checkout,
  Payment,
  SessionUser,
  PaymentMethod,
  PaymentOptions,
  PaymentProviderId,
} from '@7even/contracts';
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
import { fiatPaymentRoute, LIGHT_PAYMENT_LIMIT_MINOR, PAYMENT_ROUTING_POLICY } from '@7even/engine';
import {
  ProviderRegistry,
  providerFor,
  providerCode,
  providerIds,
  executionModeIds,
  cryptoFor,
  paymentMode,
} from './providerRegistry.ts';
import type { ProviderSource } from './providerRegistry.ts';
import type { CryptoQuoteData } from './cryptoProvider.ts';
import type { PaymentProvider, ProviderReceipt, ProviderRefund } from './provider.ts';
import { reconcilePaystackSettlements } from './paystackSettlement.ts';

export async function paymentOptions(
  pool: Pool,
  source: ProviderSource,
  actor: SessionUser,
  reservationId: string,
): Promise<PaymentOptions> {
  const r = await reservationProjection(pool, reservationId);
  if (!r) return fail(404, 'NOT_FOUND', 'Reservation not found.');
  await reservationAccess(pool, actor, r);
  const route = fiatPaymentRoute(r.price.totalMinor);
  const accounts = await rows(
    pool,
    `SELECT a.* FROM seven.business_payment_accounts a JOIN seven.businesses b USING(business_id) WHERE a.business_id=$1 AND a.workflow_state_id=${sid('APPROVED')} AND b.workflow_state_id=${sid('APPROVED')}`,
    [r.businessId],
  );
  const modeFor = (id: PaymentProviderId) => {
    try {
      return executionModeIds[paymentMode(source, id)];
    } catch {
      return null;
    }
  };
  const eligible = (id: PaymentProviderId) =>
    accounts.some(
      (a) =>
        Number(a.payment_provider_id) === providerIds[id] &&
        Number(a.execution_mode_id) === modeFor(id),
    );
  const existing = await one(
    pool,
    'SELECT payment_attempt_id FROM seven.payment_attempts WHERE reservation_id=$1 ORDER BY created_at LIMIT 1',
    [r.id],
  );
  const available = eligible(route.provider);
  const gateway =
    source instanceof ProviderRegistry
      ? source.crypto
      : source.mode === 'mock'
        ? cryptoFor(source)
        : null;
  const activeChainId =
    gateway && 'chainId' in gateway
      ? Number(gateway.chainId)
      : Number(process.env.CRYPTO_CHAIN_ID ?? '84532');
  const cryptoAvailable = Boolean(
    gateway?.enabled &&
      eligible('crypto') &&
      accounts.some(
        (a) => Number(a.payment_provider_id) === 3 && Number(a.details.chainId) === activeChainId,
      ),
  );
  return {
    fiat: {
      provider: route.provider,
      available,
      reason: available ? null : 'The business has not enabled this payment provider.',
    },
    crypto: {
      available: cryptoAvailable,
      reason: cryptoAvailable
        ? null
        : 'USDC checkout needs an approved business wallet and a configured Base connection.',
      asset: 'USDC',
      network: 'Base',
      chainId:
        gateway && 'chainId' in gateway
          ? Number(gateway.chainId)
          : Number(process.env.CRYPTO_CHAIN_ID ?? '84532'),
    },
    routingPolicyVersion: PAYMENT_ROUTING_POLICY,
    thresholdMinor: LIGHT_PAYMENT_LIMIT_MINOR,
    existingPaymentId: existing?.payment_attempt_id ?? null,
    mode: source.mode === 'mock' ? 'mock' : 'live',
  };
}

export async function checkout(
  pool: Pool,
  source: ProviderSource,
  actor: SessionUser,
  reservationId: string,
  publicOrigin: string,
  input: { method: PaymentMethod; payerAddress?: string } = { method: 'FIAT' },
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
    if (r.status !== 'HELD' || !r.holdExpiresAt || Date.parse(r.holdExpiresAt) - Date.now() < 60000)
      return fail(409, 'HOLD_EXPIRED', 'This hold is too close to expiry. Request a new quote.');
    const previous = await one(
      db,
      'SELECT * FROM seven.payment_attempts WHERE reservation_id=$1 ORDER BY created_at LIMIT 1',
      [reservationId],
    );
    if (previous) {
      const savedProvider = providerCode(previous.payment_provider_id);
      const savedMethod = savedProvider === 'crypto' ? 'USDC_BASE' : 'FIAT';
      if (savedMethod !== input.method)
        return fail(
          409,
          'PAYMENT_METHOD_LOCKED',
          'A checkout already exists. Review it before changing the payment method.',
        );
      if (previous.provider_details.mode !== paymentMode(source, savedProvider))
        return fail(
          409,
          'PROVIDER_MODE_CHANGED',
          'This checkout belongs to a different execution mode.',
        );
      return { row: previous, dispatch: false, customer: r, providerId: savedProvider };
    }
    const route = fiatPaymentRoute(r.price.totalMinor);
    const providerId: PaymentProviderId = input.method === 'USDC_BASE' ? 'crypto' : route.provider;
    const mode = paymentMode(source, providerId);
    const business = await one(
      db,
      `SELECT * FROM seven.businesses WHERE business_id=$1 AND workflow_state_id=${sid('APPROVED')}`,
      [r.businessId],
    );
    const account = business
      ? await one(
          db,
          `SELECT * FROM seven.business_payment_accounts WHERE business_id=$1 AND payment_provider_id=$2 AND workflow_state_id=${sid('APPROVED')}`,
          [r.businessId, providerIds[providerId]],
        )
      : null;
    if (!account || Number(account.execution_mode_id) !== executionModeIds[mode])
      return fail(
        409,
        'PAYMENTS_UNAVAILABLE',
        'This business has not enabled the selected payment method in this execution mode.',
      );
    if (providerId === 'crypto') {
      const gateway = cryptoFor(source);
      const chainId =
        'chainId' in gateway
          ? Number(gateway.chainId)
          : Number(process.env.CRYPTO_CHAIN_ID ?? '84532');
      if (Number(account.details.chainId) !== chainId)
        return fail(
          409,
          'PAYMENTS_UNAVAILABLE',
          'The business wallet needs approval for this Base network.',
        );
    }
    const id = randomUUID();
    const reference = `seven-${id}`;
    let cryptoQuote: CryptoQuoteData | null = null;
    if (providerId === 'crypto') {
      if (!input.payerAddress)
        return fail(422, 'WALLET_REQUIRED', 'Connect the wallet you will pay from.');
      cryptoQuote = await cryptoFor(source).prepare({
        reference,
        amountMinor: r.price.totalMinor,
        payerAddress: input.payerAddress,
        recipientAddress: account.account_code,
        expiresAt: r.holdExpiresAt,
      });
    }
    const row = (await one(
      db,
      `INSERT INTO seven.payment_attempts(payment_attempt_id,reservation_id,merchant_reference,workflow_state_id,settlement_state_id,currency_code,amount_minor,commission_minor,business_subaccount,bank_revision,provider_details,payment_provider_id,payment_method_id,routing_policy_version,checkout_url) VALUES($1,$2,$3,${sid('PENDING')},${sid('UNSETTLED')},'NGN',$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        id,
        reservationId,
        reference,
        r.price.totalMinor,
        r.price.commissionMinor,
        account.account_code,
        account.revision,
        {
          mode,
          checkoutDispatched: true,
          settlementAccount: account.details.settlementAccount ?? null,
          settlementBankCode: account.details.settlementBankCode ?? null,
        },
        providerIds[providerId],
        providerId === 'crypto' ? 2 : 1,
        route.policyVersion,
        providerId === 'crypto' ? `/checkout/crypto/${id}` : null,
      ],
    ))!;
    if (cryptoQuote) {
      await db.query(
        'INSERT INTO seven.crypto_payment_quotes(crypto_payment_quote_id,payment_attempt_id,amount_atoms,quote_data) VALUES($1,$2,$3,$4)',
        [randomUUID(), id, cryptoQuote.amountAtoms, cryptoQuote],
      );
      await db.query(
        "UPDATE seven.reservations SET expires_at=GREATEST(expires_at,now()+interval '60 minutes'),updated_at=now() WHERE reservation_id=$1",
        [reservationId],
      );
    }
    await db.query(
      `UPDATE seven.reservations SET payment_state_id=${sid('PENDING')},updated_at=now() WHERE reservation_id=$1`,
      [reservationId],
    );
    await audit(db, actor, r.businessId, 'payment.checkout_requested', id);
    return { row, dispatch: providerId !== 'crypto', customer: r, providerId };
  });
  const provider = attempt.providerId === 'crypto' ? null : providerFor(source, attempt.providerId);
  if (attempt.dispatch && provider) {
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
    return fail(409, 'PAYMENT_PENDING', 'This checkout is being reconciled. Check its status.');
  return {
    paymentId: attempt.row.payment_attempt_id,
    reference: attempt.row.merchant_reference,
    checkoutUrl: attempt.row.checkout_url,
    mode: attempt.row.provider_details.mode,
    provider: attempt.providerId,
    method: attempt.providerId === 'crypto' ? 'USDC_BASE' : 'FIAT',
  };
}

export async function applyReceipt(
  db: Connection,
  receipt: ProviderReceipt,
  actor: SessionUser | null = null,
  providerId: PaymentProviderId = 'flutterwave',
): Promise<Payment> {
  if (providerId === 'crypto')
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `crypto-transfer:${receipt.id.toLowerCase()}`,
    ]);
  const p = await one(
    db,
    'SELECT * FROM seven.payment_attempts WHERE merchant_reference=$1 FOR UPDATE',
    [receipt.reference],
  );
  if (!p) return fail(404, 'PAYMENT_NOT_FOUND', 'The payment reference is not recognized.');
  if (Number(p.payment_provider_id) !== providerIds[providerId])
    return fail(409, 'WRONG_PROVIDER', 'The receipt belongs to another provider.');
  if (
    providerId === 'crypto' &&
    (await one(
      db,
      'SELECT refund_id FROM seven.refunds WHERE payment_provider_id=3 AND provider_refund_id=$1',
      [receipt.id],
    ))
  )
    return fail(409, 'TRANSFER_REUSED', 'This transfer has already delivered a refund.');
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
    'SELECT * FROM seven.payment_attempts WHERE provider_transaction_id=$1 AND payment_provider_id=$2',
    [receipt.id, providerIds[providerId]],
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
      `INSERT INTO seven.payment_attempts(payment_attempt_id,reservation_id,merchant_reference,provider_transaction_id,workflow_state_id,settlement_state_id,currency_code,amount_minor,commission_minor,business_subaccount,bank_revision,provider_details,payment_provider_id,payment_method_id,routing_policy_version) VALUES($1,$2,$3,$4,${sid('REVIEW_REQUIRED')},${sid('UNSETTLED')},$5,$6,0,$7,$8,$9,$10,$11,$12)`,
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
        p.payment_provider_id,
        p.payment_method_id,
        p.routing_policy_version,
      ],
    );
    if (receipt.currency === 'NGN') {
      await moneyJournal(
        db,
        `receipt:${providerId}:${receipt.id}`,
        'Duplicate customer charge requires review',
        [
          { account: 'provider-clearing', amount: String(receipt.amountMinor) },
          { account: `unallocated:${duplicateId}`, amount: String(-receipt.amountMinor) },
        ],
      );
      await db.query(
        'UPDATE seven.payment_attempts SET receipt_journal_reference=$2 WHERE payment_attempt_id=$1',
        [duplicateId, `receipt:${providerId}:${receipt.id}`],
      );
    }
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
    const postings =
      providerId === 'crypto' && matched
        ? [
            { account: `crypto-value-delivered:${r.businessId}`, amount: amount.toString() },
            { account: `business-direct-crypto:${r.businessId}`, amount: (-amount).toString() },
            { account: `commission-receivable:${r.businessId}`, amount: commission.toString() },
            { account: 'platform-commission', amount: (-commission).toString() },
          ]
        : [
            { account: 'provider-clearing', amount: amount.toString() },
            {
              account: matched ? `business:${r.businessId}` : `unallocated:${p.payment_attempt_id}`,
              amount: (-amount + commission).toString(),
            },
            { account: 'platform-commission', amount: (-commission).toString() },
          ];
    await moneyJournal(
      db,
      `receipt:${providerId}:${receipt.id}`,
      providerId === 'crypto'
        ? 'NGN book value of direct business USDC receipt; platform commission receivable, no platform crypto custody'
        : 'Provider-verified hospitality payment',
      postings,
    );
    await db.query(
      'UPDATE seven.payment_attempts SET receipt_journal_reference=$2 WHERE payment_attempt_id=$1',
      [p.payment_attempt_id, `receipt:${providerId}:${receipt.id}`],
    );
    if (providerId === 'crypto' && matched)
      await db.query(
        `UPDATE seven.payment_attempts SET settlement_state_id=${sid('SETTLED')} WHERE payment_attempt_id=$1`,
        [p.payment_attempt_id],
      );
    if (receipt.feeMinor)
      await moneyJournal(db, `fee:${providerId}:${receipt.id}`, 'Provider fee borne by merchant', [
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
  // Attribute only provider-verified, amount-matched, in-time hotel confirmations.
  // Browser telemetry cannot create this outcome event.
  if (valid && matched) {
    const recovery = await one<{
      session_id: string | null;
      offering_id: string;
    }>(
      db,
      `SELECT q.recovery_session_id AS session_id, q.offering_id
       FROM seven.reservations reservation
       JOIN seven.quotes q ON q.quote_id = reservation.quote_id
       JOIN seven.offerings o ON o.offering_id = q.offering_id
       JOIN seven.sectors s ON s.sector_id = o.sector_id
       WHERE reservation.reservation_id=$1 AND s.sector_code='STAY'`,
      [r.id],
    );
    if (recovery?.session_id) {
      await db.query(
        `INSERT INTO seven.booking_recovery_events(
           recovery_event_id,event_id,session_id,offering_id,event_code,
           amount_minor,contact_channel,contact_consent,occurred_at
         ) VALUES($1,$2,$3,$4,'BOOKING_CONFIRMED',$5,'NONE',false,now())
         ON CONFLICT(event_id) DO NOTHING`,
        [randomUUID(), randomUUID(), recovery.session_id, recovery.offering_id, String(receipt.amountMinor)],
      );
    }
  }
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
      ? providerId === 'crypto'
        ? 'Your reservation is confirmed. USDC was delivered to the business wallet.'
        : 'Your reservation is confirmed. Bank settlement is tracked separately.'
      : 'We received a payment record but could not allocate this reservation. The team must review it.',
  );
  return (await paymentProjection(db, p.payment_attempt_id))!;
}

export async function verifyPayment(
  pool: Pool,
  source: ProviderSource,
  actor: SessionUser | null,
  reference: string,
  transactionId?: string,
  walletSignature?: string,
): Promise<Payment> {
  const p = await one(pool, 'SELECT * FROM seven.payment_attempts WHERE merchant_reference=$1', [
    reference,
  ]);
  if (!p) return fail(404, 'NOT_FOUND', 'Payment not found.');
  const providerId = providerCode(p.payment_provider_id);
  if (p.provider_details.mode !== paymentMode(source, providerId))
    return fail(
      409,
      'PROVIDER_MODE_CHANGED',
      'This payment belongs to a different execution mode.',
    );
  if (actor)
    await reservationAccess(pool, actor, (await reservationProjection(pool, p.reservation_id))!);
  if (providerId === 'crypto') {
    const gateway = cryptoFor(source);
    let quote = await one(
      pool,
      'SELECT * FROM seven.crypto_payment_quotes WHERE payment_attempt_id=$1',
      [p.payment_attempt_id],
    );
    if (!quote) return fail(409, 'CRYPTO_QUOTE_MISSING', 'The stored crypto quote needs review.');
    if (!quote.payer_verified_at) {
      if (
        !actor ||
        !walletSignature ||
        !(await gateway.verifySignature(quote.quote_data, walletSignature))
      )
        return fail(
          403,
          'WALLET_PROOF_REQUIRED',
          'Sign the payment message with the quoted payer wallet.',
        );
      await pool.query(
        'UPDATE seven.crypto_payment_quotes SET payer_verified_at=now(),updated_at=now() WHERE payment_attempt_id=$1 AND payer_verified_at IS NULL',
        [p.payment_attempt_id],
      );
    }
    const hash = transactionId ?? quote.transaction_hash;
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash))
      return fail(422, 'TRANSACTION_REQUIRED', 'Supply the USDC transaction hash.');
    await transaction(pool, async (db) => {
      const locked = (await one(
        db,
        'SELECT * FROM seven.crypto_payment_quotes WHERE payment_attempt_id=$1 FOR UPDATE',
        [p.payment_attempt_id],
      ))!;
      if (locked.transaction_hash && locked.transaction_hash !== hash.toLowerCase())
        return fail(
          409,
          'TRANSACTION_LOCKED',
          'A different transaction is already being checked. Do not send another payment.',
        );
      await db.query(
        'UPDATE seven.crypto_payment_quotes SET transaction_hash=$2,updated_at=now() WHERE payment_attempt_id=$1 AND transaction_hash IS NULL',
        [p.payment_attempt_id, hash.toLowerCase()],
      );
    });
    const evidence = await gateway.verify(quote.quote_data, hash.toLowerCase());
    return transaction(pool, async (db) => {
      await db.query(
        'UPDATE seven.crypto_payment_quotes SET transfer_evidence=$2,updated_at=now() WHERE payment_attempt_id=$1',
        [p.payment_attempt_id, evidence],
      );
      if (evidence.status === 'pending')
        return (await paymentProjection(db, p.payment_attempt_id))!;
      const matched = evidence.status === 'successful';
      return applyReceipt(
        db,
        {
          id: `${quote.quote_data.chainId}:${hash.toLowerCase()}`,
          reference,
          status: 'successful',
          currency: matched ? 'NGN' : 'USDC',
          amountMinor: matched ? Number(p.amount_minor) : 0,
          feeMinor: 0,
        },
        actor,
        'crypto',
      );
    });
  }
  const provider = providerFor(source, providerId);
  const receipt = await provider.verify(reference, transactionId);
  if ((transactionId && receipt.id !== transactionId) || receipt.reference !== reference)
    return fail(409, 'PAYMENT_MISMATCH', 'The verified transaction does not match this checkout.');
  return transaction(pool, (db) => applyReceipt(db, receipt, actor, providerId));
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
      result.id !== refund.provider_refund_id ||
      result.amountMinor !== Number(refund.amount_minor) ||
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
              'A later provider observation contradicts the confirmed refund identity, amount or delivery status. Review without repeating the refund.',
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
    [p.receipt_journal_reference ?? `receipt:${p.provider_transaction_id}`],
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
  source: ProviderSource,
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
    if (p.provider_details.mode !== paymentMode(source, providerCode(p.payment_provider_id)))
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
      `INSERT INTO seven.refunds(refund_id,payment_attempt_id,amount_minor,workflow_state_id,reason,operation_reference,payment_provider_id) VALUES($1,$2,$3,${sid('DISPATCHED')},$4,$5,$6) RETURNING *`,
      [
        id,
        p.payment_attempt_id,
        p.provider_details.actualAmountMinor ?? p.amount_minor,
        reason,
        `refund:${p.payment_attempt_id}`,
        p.payment_provider_id,
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
  if (providerCode(intent.payment.payment_provider_id) === 'crypto') {
    if (intent.dispatch) {
      const quote = (await one(
        pool,
        'SELECT amount_atoms FROM seven.crypto_payment_quotes WHERE payment_attempt_id=$1',
        [intent.payment.payment_attempt_id],
      ))!;
      await pool.query(
        `UPDATE seven.refunds SET workflow_state_id=${sid('REQUESTED')},provider_details=provider_details||$2::jsonb,updated_at=now() WHERE refund_id=$1`,
        [
          intent.refund.refund_id,
          {
            cryptoAmountAtoms: quote.amount_atoms,
            deliveryKind: 'MERCHANT_WALLET_RETURN_REQUIRED',
          },
        ],
      );
    }
    return (await paymentProjection(pool, intent.payment.payment_attempt_id))!;
  }
  if (intent.dispatch) {
    try {
      const provider = providerFor(source, providerCode(intent.payment.payment_provider_id));
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

export async function verifyCryptoRefund(
  pool: Pool,
  source: ProviderSource,
  actor: SessionUser | null,
  paymentId: string,
  hash?: string,
  simulate = false,
): Promise<Payment> {
  const payment = await one(
    pool,
    'SELECT * FROM seven.payment_attempts WHERE payment_attempt_id=$1',
    [paymentId],
  );
  if (!payment || providerCode(payment.payment_provider_id) !== 'crypto')
    return fail(404, 'NOT_FOUND', 'Crypto payment not found.');
  if (payment.provider_details.mode !== paymentMode(source, 'crypto'))
    return fail(
      409,
      'PROVIDER_MODE_CHANGED',
      'This payment belongs to a different execution mode.',
    );
  const reservation = (await reservationProjection(pool, payment.reservation_id))!;
  if (actor) requireTenant(actor, reservation.businessId, true);
  const refund = await one(
    pool,
    'SELECT f.*,s.workflow_state_code FROM seven.refunds f JOIN seven.workflow_states s USING(workflow_state_id) WHERE payment_attempt_id=$1 ORDER BY created_at LIMIT 1',
    [paymentId],
  );
  if (!refund)
    return fail(
      409,
      'REFUND_NOT_REQUESTED',
      'Request the refund before supplying a wallet return transfer.',
    );
  if (refund.workflow_state_code === 'DELIVERED')
    return (await paymentProjection(pool, paymentId))!;
  const original = (await one(
    pool,
    'SELECT * FROM seven.crypto_payment_quotes WHERE payment_attempt_id=$1',
    [paymentId],
  ))!;
  const quote: CryptoQuoteData = {
    ...original.quote_data,
    reference: refund.operation_reference,
    payerAddress: original.quote_data.recipientAddress,
    recipientAddress: original.quote_data.payerAddress,
    createdAt: new Date(refund.created_at).toISOString(),
    expiresAt: new Date(new Date(refund.created_at).getTime() + 30 * 86400000).toISOString(),
    message: '',
  };
  const gateway = cryptoFor(source);
  if (simulate) {
    const { MockCryptoGateway } = await import('./cryptoProvider.ts');
    if (
      !actor ||
      !(gateway instanceof MockCryptoGateway) ||
      source.mode !== 'mock' ||
      process.env.NODE_ENV === 'production'
    )
      return fail(404, 'NOT_FOUND', 'Local test refund is unavailable.');
    hash = gateway.completeReturn(quote, hash);
  }
  const candidate = hash ?? refund.provider_details.pendingHash;
  if (!candidate || !/^0x[a-fA-F0-9]{64}$/.test(candidate))
    return fail(422, 'TRANSACTION_REQUIRED', 'Supply the business wallet refund transaction hash.');
  await transaction(pool, async (db) => {
    const locked = (await one(db, 'SELECT * FROM seven.refunds WHERE refund_id=$1 FOR UPDATE', [
      refund.refund_id,
    ]))!;
    if (
      locked.provider_details.pendingHash &&
      locked.provider_details.pendingHash !== candidate.toLowerCase()
    )
      return fail(
        409,
        'TRANSACTION_LOCKED',
        'A return transfer is already being checked. Do not send another refund.',
      );
    await db.query(
      'UPDATE seven.refunds SET provider_details=provider_details||$2::jsonb,updated_at=now() WHERE refund_id=$1',
      [refund.refund_id, { pendingHash: candidate.toLowerCase() }],
    );
  });
  const evidence = await gateway.verifyReturn(quote, candidate.toLowerCase());
  await transaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `crypto-transfer:${quote.chainId}:${candidate.toLowerCase()}`,
    ]);
    const locked = (await one(
      db,
      'SELECT f.*,s.workflow_state_code FROM seven.refunds f JOIN seven.workflow_states s USING(workflow_state_id) WHERE refund_id=$1 FOR UPDATE OF f',
      [refund.refund_id],
    ))!;
    if (locked.workflow_state_code === 'DELIVERED') return;
    await db.query(
      'UPDATE seven.refunds SET provider_details=provider_details||$2::jsonb,updated_at=now() WHERE refund_id=$1',
      [refund.refund_id, { cryptoEvidence: evidence }],
    );
    if (evidence.status === 'pending') return;
    if (evidence.status !== 'successful') {
      await db.query(
        `UPDATE seven.refunds SET workflow_state_id=${sid('UNKNOWN')},provider_details=provider_details||$2::jsonb WHERE refund_id=$1`,
        [
          refund.refund_id,
          { exception: evidence.exception ?? 'The wallet return requires review.' },
        ],
      );
      return;
    }
    const identity = `${quote.chainId}:${candidate.toLowerCase()}`;
    if (
      await one(
        db,
        'SELECT payment_attempt_id FROM seven.payment_attempts WHERE payment_provider_id=3 AND provider_transaction_id=$1',
        [identity],
      )
    )
      return fail(409, 'TRANSFER_REUSED', 'This transfer has already funded a payment.');
    await db.query(
      'INSERT INTO seven.crypto_refund_proofs(crypto_refund_proof_id,refund_id,amount_atoms,recipient_address,transaction_hash,transfer_evidence) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(refund_id) DO NOTHING',
      [
        randomUUID(),
        refund.refund_id,
        quote.amountAtoms,
        quote.recipientAddress,
        candidate.toLowerCase(),
        evidence,
      ],
    );
    await applyRefund(db, refund.refund_id, {
      id: identity,
      status: 'completed-offline',
      amountMinor: Number(refund.amount_minor),
    });
    await audit(
      db,
      actor,
      reservation.businessId,
      'refund.crypto_return_verified',
      refund.refund_id,
    );
  });
  return (await paymentProjection(pool, paymentId))!;
}

export async function reconcile(
  pool: Pool,
  source: ProviderSource,
): Promise<{ processed: number; pending: number; exceptions: number }> {
  let processed = 0;
  let exceptions = 0;
  const pending = await rows(
    pool,
    `SELECT p.* FROM seven.payment_attempts p WHERE workflow_state_id IN (${sid('PENDING')},${sid('UNKNOWN')}) AND (p.payment_provider_id<>3 OR EXISTS(SELECT 1 FROM seven.crypto_payment_quotes q WHERE q.payment_attempt_id=p.payment_attempt_id AND q.payer_verified_at IS NOT NULL AND q.transaction_hash IS NOT NULL)) AND coalesce((provider_details->>'verificationChecks')::integer,0)<120 AND coalesce((provider_details->>'nextVerificationAt')::timestamptz,now())<=now() ORDER BY created_at LIMIT 25`,
  );
  for (const p of pending) {
    const claimed = await one(
      pool,
      `UPDATE seven.payment_attempts SET provider_details=provider_details||jsonb_build_object('verificationChecks',coalesce((provider_details->>'verificationChecks')::integer,0)+1,'nextVerificationAt',now()+interval '30 seconds') WHERE payment_attempt_id=$1 AND coalesce((provider_details->>'nextVerificationAt')::timestamptz,now())<=now() RETURNING payment_attempt_id`,
      [p.payment_attempt_id],
    );
    if (!claimed) continue;
    try {
      await verifyPayment(
        pool,
        source,
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
    `SELECT * FROM seven.refunds WHERE workflow_state_id IN (${sid('REQUESTED')},${sid('INITIATED')},${sid('UNKNOWN')},${sid('DISPATCHED')}) AND (workflow_state_id<>${sid('DISPATCHED')} OR created_at<now()-interval '2 minutes') AND coalesce((provider_details->>'recoveryChecks')::integer,0)<120 AND coalesce((provider_details->>'nextRecoveryAt')::timestamptz,now())<=now() ORDER BY created_at LIMIT 25`,
  );
  for (const r of refunds) {
    if (Number(r.payment_provider_id) === 3 && !r.provider_details.pendingHash) continue;
    const claimed = await one(
      pool,
      `UPDATE seven.refunds SET provider_details=provider_details||jsonb_build_object('recoveryChecks',coalesce((provider_details->>'recoveryChecks')::integer,0)+1,'nextRecoveryAt',now()+interval '30 seconds') WHERE refund_id=$1 AND coalesce((provider_details->>'nextRecoveryAt')::timestamptz,now())<=now() RETURNING refund_id`,
      [r.refund_id],
    );
    if (!claimed) continue;
    if (providerCode(r.payment_provider_id) === 'crypto') {
      if (r.provider_details.pendingHash) {
        try {
          await verifyCryptoRefund(pool, source, null, r.payment_attempt_id);
          processed++;
        } catch {
          exceptions++;
        }
      }
      continue;
    }
    try {
      const adapter = providerFor(source, providerCode(r.payment_provider_id));
      let result: ProviderRefund | null;
      if (r.provider_refund_id) result = await adapter.refundStatus(r.provider_refund_id);
      else {
        const payment = await one(
          pool,
          'SELECT provider_transaction_id FROM seven.payment_attempts WHERE payment_attempt_id=$1',
          [r.payment_attempt_id],
        );
        result =
          payment?.provider_transaction_id && adapter.findRefund
            ? await adapter.findRefund(payment.provider_transaction_id, Number(r.amount_minor))
            : null;
      }
      if (result) {
        await transaction(pool, (db) => applyRefund(db, r.refund_id, result));
        processed++;
      } else exceptions++;
    } catch {
      exceptions++;
    }
  }
  await pool.query(
    `UPDATE seven.payment_attempts SET workflow_state_id=${sid('UNKNOWN')},provider_details=provider_details||jsonb_build_object('recoveryException','Payment verification limit reached. Review the saved transaction before any new payment.','verificationExhaustedAt',now()),updated_at=now() WHERE workflow_state_id IN (${sid('PENDING')},${sid('UNKNOWN')}) AND coalesce((provider_details->>'verificationChecks')::integer,0)>=120 AND NOT(provider_details ? 'verificationExhaustedAt')`,
  );
  await pool.query(
    `UPDATE seven.refunds SET workflow_state_id=${sid('UNKNOWN')},provider_details=provider_details||jsonb_build_object('recoveryException','Refund verification limit reached. Review the existing return before any new refund.','recoveryExhaustedAt',now()),updated_at=now() WHERE workflow_state_id IN (${sid('REQUESTED')},${sid('INITIATED')},${sid('UNKNOWN')},${sid('DISPATCHED')}) AND coalesce((provider_details->>'recoveryChecks')::integer,0)>=120 AND NOT(provider_details ? 'recoveryExhaustedAt')`,
  );
  const settlement =
    source instanceof ProviderRegistry
      ? await reconcileSettlements(
          pool,
          source.adapters.flutterwave ?? new (await import('./provider.ts')).MockProvider(),
        )
      : await reconcileSettlements(pool, source);
  processed += settlement.processed;
  exceptions += settlement.exceptions;
  const paystackSettlement = await reconcilePaystackSettlements(pool, source);
  processed += paystackSettlement.processed;
  exceptions += paystackSettlement.exceptions;
  return {
    processed,
    pending:
      Math.max(0, pending.length + refunds.length - processed) +
      settlement.pending +
      paystackSettlement.pending,
    exceptions,
  };
}

/** v3 settlement detail contract: documented transactions[] and exact business bank snapshot. */
export async function reconcileSettlements(
  pool: Pool,
  provider: PaymentProvider,
): Promise<{ processed: number; pending: number; exceptions: number }> {
  if (provider.mode !== 'flutterwave') return { processed: 0, pending: 0, exceptions: 0 };
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
