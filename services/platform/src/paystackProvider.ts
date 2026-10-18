import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  PaymentProvider,
  ProviderCheckout,
  ProviderReceipt,
  ProviderRefund,
} from './provider.ts';
import { parseProviderJson } from './provider.ts';

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Paystack returned an invalid object.');
  return value as Record<string, unknown>;
};

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value || value.length > 1000)
    throw new Error(`Paystack returned an invalid ${field}.`);
  return value;
}

function identifier(value: unknown): string {
  const id = text(value, 'identifier');
  if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
    throw new Error('Paystack returned an invalid identifier.');
  return id;
}

/** Paystack uses kobo directly. Passing these values through decimalToMinor would multiply by 100. */
function minor(value: unknown, allowZero = true): number {
  const token = typeof value === 'number' ? String(value) : value;
  if (typeof token !== 'string' || !/^(0|[1-9]\d{0,15})$/.test(token))
    throw new Error('Paystack returned an invalid integer minor-unit amount.');
  const exact = BigInt(token);
  if (exact > BigInt(Number.MAX_SAFE_INTEGER) || (!allowZero && exact === 0n))
    throw new Error('Paystack returned an invalid integer minor-unit amount.');
  return Number(exact);
}

function reference(value: unknown): string {
  const result = text(value, 'reference');
  if (!/^[A-Za-z0-9.=-]{1,200}$/.test(result))
    throw new Error('Paystack returned an invalid reference.');
  return result;
}

function subaccountCode(value: unknown): string {
  const code = text(value, 'subaccount');
  if (!/^ACCT_[A-Za-z0-9]{1,100}$/.test(code))
    throw new Error('Paystack returned an invalid subaccount.');
  return code;
}

function currency(value: unknown): string {
  const code = text(value, 'currency');
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('Paystack returned an invalid currency.');
  return code;
}

const paymentStatuses = new Set([
  'success',
  'failed',
  'abandoned',
  'ongoing',
  'pending',
  'processing',
  'queued',
  'reversed',
]);

function paymentStatus(value: unknown): string {
  const status = text(value, 'payment status');
  if (!paymentStatuses.has(status)) throw new Error('Paystack returned an invalid payment status.');
  return status;
}

function refundResult(data: Record<string, unknown>): ProviderRefund {
  const status = text(data.status, 'refund status');
  if (!['processed', 'failed', 'pending', 'processing', 'needs-attention'].includes(status))
    throw new Error('Paystack returned an invalid refund status.');
  if (currency(data.currency) !== 'NGN')
    throw new Error('Paystack returned an unexpected refund currency.');
  return {
    id: identifier(data.id),
    status:
      status === 'processed'
        ? 'completed-bank-transfer'
        : status === 'failed'
          ? 'failed'
          : 'pending',
    amountMinor: minor(data.amount, false),
  };
}

export function validPaystackWebhook(
  raw: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!secret || !signature || !/^[a-fA-F0-9]{128}$/.test(signature)) return false;
  const expected = createHmac('sha512', secret).update(raw).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Hosted checkout only: 7even does not receive card details or save reusable authorizations. */
export class PaystackProvider implements PaymentProvider {
  mode = 'paystack' as const;
  key: string;
  transport: typeof fetch;

  constructor(key: string, transport: typeof fetch = fetch) {
    this.key = key;
    this.transport = transport;
  }

  async request(path: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await this.transport(`https://api.paystack.co${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    const result = record(parseProviderJson(await response.text()));
    if (!response.ok || result.status !== true)
      throw new Error(
        'Paystack request did not succeed; reconcile the operation before retrying financial effects.',
      );
    return result;
  }

  async checkout(input: ProviderCheckout): Promise<string> {
    const amount = minor(input.amountMinor, false);
    const commission = minor(input.commissionMinor);
    if (commission >= amount) throw new Error('The commission must be smaller than the payment.');
    if (input.currency !== 'NGN') throw new Error('Paystack checkout currently supports NGN only.');
    const expectedReference = reference(input.reference);
    const subaccount = subaccountCode(input.subaccountId);
    const callback = new URL(input.redirectUrl);
    if (!['https:', 'http:'].includes(callback.protocol) || callback.username || callback.password)
      throw new Error('Invalid checkout callback URL.');
    if (input.expiresAt) {
      const remaining = Date.parse(input.expiresAt) - Date.now();
      if (!Number.isFinite(remaining) || remaining < 60000)
        throw new Error('The inventory hold is too close to expiry for a new checkout.');
    }
    const data = record(
      (
        await this.request('/transaction/initialize', {
          reference: expectedReference,
          amount: String(amount),
          currency: 'NGN',
          email: input.email,
          callback_url: input.redirectUrl,
          subaccount,
          transaction_charge: commission,
          bearer: 'subaccount',
        })
      ).data,
    );
    if (reference(data.reference) !== expectedReference)
      throw new Error('Paystack returned a different checkout reference.');
    text(data.access_code, 'access code');
    const link = new URL(text(data.authorization_url, 'checkout destination'));
    if (
      link.origin !== 'https://checkout.paystack.com' ||
      link.username ||
      link.password ||
      link.pathname === '/'
    )
      throw new Error('Unexpected Paystack checkout destination.');
    // Paystack documents an integration-wide session timeout, not an absolute checkout expiry.
    return link.href;
  }

  async verify(expectedReference: string, transactionId?: string): Promise<ProviderReceipt> {
    reference(expectedReference);
    if (transactionId !== undefined) identifier(transactionId);
    const data = record(
      (await this.request(`/transaction/verify/${encodeURIComponent(expectedReference)}`)).data,
    );
    const id = identifier(data.id);
    if (transactionId !== undefined && id !== transactionId)
      throw new Error('Paystack returned a different transaction identifier.');
    if (reference(data.reference) !== expectedReference)
      throw new Error('Paystack returned a different transaction reference.');
    const status = paymentStatus(data.status);
    return {
      id,
      reference: expectedReference,
      status: status === 'success' ? 'successful' : status,
      currency: currency(data.currency),
      amountMinor: minor(data.amount, false),
      feeMinor: status !== 'success' && data.fees === null ? 0 : minor(data.fees),
    };
  }

  async refund(
    transactionId: string,
    amountMinor: number,
    reason: string,
  ): Promise<ProviderRefund> {
    identifier(transactionId);
    minor(amountMinor, false);
    const data = record(
      (
        await this.request('/refund', {
          transaction: transactionId,
          amount: amountMinor,
          currency: 'NGN',
          merchant_note: reason,
        })
      ).data,
    );
    const returnedTransaction =
      typeof data.transaction === 'object' ? record(data.transaction).id : data.transaction;
    if (identifier(returnedTransaction) !== transactionId)
      throw new Error('Paystack returned a different refund transaction.');
    const result = refundResult(data);
    if (result.amountMinor !== amountMinor)
      throw new Error('Paystack returned a different refund amount.');
    return result;
  }

  async refundStatus(id: string): Promise<ProviderRefund> {
    identifier(id);
    const result = refundResult(
      record((await this.request(`/refund/${encodeURIComponent(id)}`)).data),
    );
    if (result.id !== id) throw new Error('Paystack returned a different refund identifier.');
    return result;
  }

  /** Read-only recovery: incomplete pagination or multiple refunds cannot identify one dispatch. */
  async findRefund(transactionId: string, amountMinor: number): Promise<ProviderRefund | null> {
    identifier(transactionId);
    minor(amountMinor, false);
    const result = await this.request(
      `/refund?transaction=${encodeURIComponent(transactionId)}&perPage=2&page=1`,
    );
    if (!Array.isArray(result.data)) throw new Error('Invalid Paystack refund lookup response.');
    if (result.data.length !== 1 || result.meta === undefined) return null;
    const meta = record(result.meta);
    if (meta.total !== '1' || meta.page !== '1' || meta.pageCount !== '1') return null;
    const data = record(result.data[0]);
    const returnedTransaction =
      typeof data.transaction === 'object' ? record(data.transaction).id : data.transaction;
    if (
      identifier(returnedTransaction) !== transactionId ||
      data.currency !== 'NGN' ||
      minor(data.amount, false) !== amountMinor
    )
      return null;
    return refundResult(data);
  }

  async subaccount(id: string): Promise<Record<string, unknown>> {
    subaccountCode(id);
    const data = record((await this.request(`/subaccount/${encodeURIComponent(id)}`)).data);
    if (subaccountCode(data.subaccount_code) !== id)
      throw new Error('Paystack returned a different subaccount.');
    const account = text(data.account_number, 'bank account number');
    if (!/^\d{10}$/.test(account))
      throw new Error('Paystack returned an invalid bank account number.');
    if (currency(data.currency) !== 'NGN')
      throw new Error('Unexpected Paystack subaccount currency.');
    if (!['live', 'test'].includes(String(data.domain)))
      throw new Error('Paystack returned an invalid account domain.');
    if (![true, false, '1', '0'].includes(data.active as boolean | string))
      throw new Error('Paystack returned an invalid account active flag.');
    const bankCode = data.bank_code === undefined ? null : text(data.bank_code, 'bank code');
    if (bankCode !== null && !/^\d{3,20}$/.test(bankCode))
      throw new Error('Paystack returned an invalid bank code.');
    return {
      subaccount_id: id,
      providerRawId: identifier(data.id),
      account_number: account,
      account_name: data.account_name === null ? null : text(data.account_name, 'account name'),
      account_bank: bankCode,
      bankName: text(data.settlement_bank, 'bank name'),
      providerBankId: identifier(data.bank),
      country: 'NG',
      currency: 'NGN',
      active: data.active === true || data.active === '1',
      domain: data.domain,
      is_verified: data.is_verified === true,
    };
  }

  async settlements(subaccountId: string): Promise<Record<string, unknown>[]> {
    subaccountCode(subaccountId);
    const account = record(
      (await this.request(`/subaccount/${encodeURIComponent(subaccountId)}`)).data,
    );
    if (subaccountCode(account.subaccount_code) !== subaccountId)
      throw new Error('Paystack returned a different settlement subaccount.');
    const accountId = identifier(account.id);
    const result = await this.request(`/settlement?subaccount=${accountId}&perPage=5&page=1`);
    if (!Array.isArray(result.data)) throw new Error('Invalid Paystack settlements response.');
    const summaries: Record<string, unknown>[] = [];
    for (const entry of result.data.slice(0, 5)) {
      const summary = record(entry);
      const id = identifier(summary.id);
      if (!['success', 'processing', 'pending', 'failed'].includes(String(summary.status)))
        throw new Error('Paystack returned an invalid settlement status.');
      const transactions = await this.request(`/settlement/${id}/transactions?perPage=100&page=1`);
      if (!Array.isArray(transactions.data))
        throw new Error('Invalid Paystack settlement transactions response.');
      summaries.push({
        id,
        status: summary.status,
        currency: currency(summary.currency),
        total_amount: String(minor(summary.total_amount)),
        total_fees: String(minor(summary.total_fees)),
        settlement_date: summary.settlement_date ?? null,
        queriedSubaccount: subaccountId,
        providerSubaccountId: accountId,
        transactions: transactions.data.slice(0, 100).map((value) => {
          const transaction = record(value);
          return {
            id: identifier(transaction.id),
            reference: reference(transaction.reference),
            status: paymentStatus(transaction.status),
            currency: currency(transaction.currency),
            amount: String(minor(transaction.amount, false)),
            fees: String(minor(transaction.fees)),
          };
        }),
        transactionsComplete:
          transactions.data.length <= 100 &&
          transactions.meta !== undefined &&
          ['0', '1'].includes(String(record(transactions.meta).pageCount)),
        // Public settlement responses do not prove the destination bank or a transaction's split net.
        bankSettlementEvidence: false,
      });
    }
    return summaries;
  }
}
