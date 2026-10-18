import type { Pool, QueryResultRow } from 'pg';
import { one, rows } from './db.ts';
import type { PaymentProvider } from './provider.ts';
import type { ProviderSource } from './providerRegistry.ts';
import { ProviderRegistry, providerFor, providerIds } from './providerRegistry.ts';
import { sid } from './store.ts';

interface Observation {
  reference: string;
  status: string;
  retrievedAt: string;
  bankDeliveryConfirmed: false;
  transaction: {
    id: string;
    reference: string;
    status: 'success';
    currency: 'NGN';
    amountMinor: string;
    feeMinor: string;
  };
}

const missingBankEvidence =
  'Paystack settlement reports do not prove the approved destination bank or per-transaction split net. Bank delivery remains unconfirmed and needs independent reconciliation.';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Paystack supplied malformed settlement evidence.');
  return value as Record<string, unknown>;
}

function identifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d{0,19}$/.test(value) ||
    BigInt(value) > 18446744073709551615n
  )
    throw new Error('Paystack supplied an invalid settlement identity.');
  return value;
}

function minor(value: unknown): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    throw new Error('Paystack settlement amounts must be exact integer minor units.');
  const token = typeof value === 'number' ? String(value) : value;
  if (typeof token !== 'string' || !/^(0|[1-9]\d{0,15})$/.test(token))
    throw new Error('Paystack settlement amounts must be exact integer minor units.');
  const result = BigInt(token);
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Paystack settlement amounts exceed supported integer bounds.');
  return result;
}

/** Whitelist only documented observation fields; neither totals nor supplied bank fields prove delivery. */
function observation(
  summaries: Record<string, unknown>[],
  attempt: QueryResultRow,
  retrievedAt: string,
): Observation | null {
  const candidates: { summary: Record<string, unknown>; transaction: Record<string, unknown> }[] =
    [];
  for (const summary of summaries.slice(0, 5)) {
    if (!Array.isArray(summary.transactions))
      throw new Error('Paystack supplied a settlement without transaction evidence.');
    for (const item of summary.transactions.slice(0, 100)) {
      const transaction = record(item);
      if (
        transaction.id === attempt.provider_transaction_id ||
        transaction.reference === attempt.merchant_reference
      )
        candidates.push({ summary, transaction });
    }
  }
  if (candidates.length === 0) return null;
  if (candidates.length !== 1)
    throw new Error('Paystack supplied ambiguous settlement evidence for this transaction.');
  const candidate = candidates[0];
  if (!candidate) return null;
  const { summary, transaction } = candidate;
  if (
    summary.queriedSubaccount !== attempt.business_subaccount ||
    summary.currency !== 'NGN' ||
    transaction.currency !== 'NGN' ||
    transaction.id !== attempt.provider_transaction_id ||
    transaction.reference !== attempt.merchant_reference ||
    transaction.status !== 'success'
  )
    throw new Error(
      'Paystack settlement evidence does not match the saved account and transaction.',
    );
  if (!['success', 'processing', 'pending', 'failed'].includes(String(summary.status)))
    throw new Error('Paystack supplied an unknown settlement status.');
  if (
    summary.bankSettlementEvidence === true ||
    ['settlement_amount', 'net_amount', 'netAmountMinor'].some((key) =>
      Object.hasOwn(transaction, key),
    )
  )
    throw new Error(
      'Paystack supplied undocumented bank or transaction-net evidence that cannot establish delivery.',
    );
  const amount = minor(transaction.amount);
  const fee = minor(transaction.fees);
  if (
    amount !== BigInt(attempt.amount_minor) ||
    amount === 0n ||
    fee > amount ||
    fee !== minor(attempt.provider_details.feeMinor)
  )
    throw new Error('Paystack settlement amount or fee contradicts the verified receipt.');
  return {
    reference: identifier(summary.id),
    status: String(summary.status),
    retrievedAt,
    bankDeliveryConfirmed: false,
    transaction: {
      id: identifier(transaction.id),
      reference: attempt.merchant_reference,
      status: 'success',
      currency: 'NGN',
      amountMinor: amount.toString(),
      feeMinor: fee.toString(),
    },
  };
}

/** Refresh processor reports only. This function never books money or confirms bank settlement. */
export async function reconcilePaystackSettlements(
  pool: Pool,
  source: ProviderSource,
): Promise<{ processed: number; pending: number; exceptions: number }> {
  const outcome = { processed: 0, pending: 0, exceptions: 0 };
  if (source instanceof ProviderRegistry && source.mode === 'mock') return outcome;
  let adapter: PaymentProvider;
  try {
    adapter = providerFor(source, 'paystack');
  } catch {
    return outcome;
  }
  if (adapter.mode !== 'paystack') return outcome;
  const attempts = await rows(
    pool,
    `SELECT * FROM seven.payment_attempts WHERE payment_provider_id=$1
     AND provider_details->>'mode'='paystack' AND workflow_state_id=${sid('PAID')}
     AND settlement_state_id<>${sid('SETTLED')} AND settlement_checks<12
     AND next_settlement_check_at<=now() ORDER BY created_at,payment_attempt_id LIMIT 25`,
    [providerIds.paystack],
  );
  const subaccounts = [
    ...new Set(attempts.map((attempt) => String(attempt.business_subaccount))),
  ].slice(0, 3);
  for (const subaccount of subaccounts) {
    const ids = attempts
      .filter((attempt) => attempt.business_subaccount === subaccount)
      .map((attempt) => attempt.payment_attempt_id);
    const claimed = await rows(
      pool,
      `UPDATE seven.payment_attempts SET settlement_checks=settlement_checks+1,
       next_settlement_check_at=now()+interval '15 minutes',
       settlement_state_id=CASE WHEN settlement_checks+1>=12 THEN ${sid('FLAGGED')} ELSE settlement_state_id END,
       provider_details=CASE WHEN settlement_checks+1>=12 THEN provider_details||$3::jsonb ELSE provider_details END
       WHERE payment_attempt_id=ANY($1::uuid[]) AND payment_provider_id=$2
       AND provider_details->>'mode'='paystack' AND workflow_state_id=${sid('PAID')}
       AND settlement_state_id<>${sid('SETTLED')} AND settlement_checks<12
       AND next_settlement_check_at<=now() RETURNING *`,
      [
        ids,
        providerIds.paystack,
        {
          bankDeliveryConfirmed: false,
          settlementException: `Automatic Paystack settlement checks are exhausted. Operational review is required. ${missingBankEvidence}`,
        },
      ],
    );
    if (claimed.length === 0) continue;
    let summaries: Record<string, unknown>[] | null = null;
    try {
      summaries = await adapter.settlements(subaccount);
      if (!Array.isArray(summaries)) summaries = null;
    } catch {
      // A timeout consumes the already persisted attempt; the next worker respects its backoff.
    }
    const retrievedAt = new Date().toISOString();
    for (const attempt of claimed) {
      let report: Observation | null = null;
      let exception: string | null = null;
      try {
        if (!summaries)
          throw new Error(
            'Paystack settlement reports could not be retrieved. Bank delivery is unconfirmed.',
          );
        report = observation(summaries, attempt, retrievedAt);
        if (report?.status === 'failed')
          exception = 'Paystack reports a failed settlement. Bank delivery is unconfirmed.';
      } catch (error) {
        exception =
          error instanceof Error ? error.message : 'Paystack settlement evidence requires review.';
      }
      const exhausted = Number(attempt.settlement_checks) >= 12;
      const flagged = exception !== null || exhausted;
      const saved = await one(
        pool,
        `UPDATE seven.payment_attempts SET settlement_state_id=${sid(flagged ? 'FLAGGED' : 'PENDING')},
         provider_details=provider_details||$2::jsonb,updated_at=now()
         WHERE payment_attempt_id=$1 AND payment_provider_id=$3 AND workflow_state_id=${sid('PAID')}
         AND settlement_state_id<>${sid('SETTLED')} AND settlement_checks=$4 RETURNING payment_attempt_id`,
        [
          attempt.payment_attempt_id,
          {
            ...(report ? { providerReportedSettlement: report } : {}),
            bankDeliveryConfirmed: false,
            settlementException: [
              exception,
              exhausted
                ? 'Automatic Paystack settlement checks are exhausted. Operational review is required.'
                : null,
              report
                ? missingBankEvidence
                : `No matching bank-delivery proof is available. ${missingBankEvidence}`,
            ]
              .filter(Boolean)
              .join(' '),
          },
          providerIds.paystack,
          attempt.settlement_checks,
        ],
      );
      if (!saved) continue;
      if (flagged) outcome.exceptions++;
      else outcome.pending++;
    }
  }
  return outcome;
}
