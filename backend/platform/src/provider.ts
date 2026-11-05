import { timingSafeEqual } from 'node:crypto';

export interface ProviderCheckout {
  reference: string;
  amountMinor: number;
  commissionMinor: number;
  currency: string;
  subaccountId: string;
  email: string;
  displayName: string;
  redirectUrl: string;
  expiresAt?: string;
}
export interface ProviderReceipt {
  id: string;
  reference: string;
  status: string;
  currency: string;
  amountMinor: number;
  feeMinor: number;
}
export interface ProviderRefund {
  id: string;
  status: string;
  amountMinor: number;
}
export interface PaymentProvider {
  mode: 'mock' | 'flutterwave' | 'paystack' | 'crypto';
  checkout(input: ProviderCheckout): Promise<string>;
  verify(reference: string, transactionId?: string): Promise<ProviderReceipt>;
  refund(transactionId: string, amountMinor: number, reason: string): Promise<ProviderRefund>;
  refundStatus(id: string): Promise<ProviderRefund>;
  findRefund?(transactionId: string, amountMinor: number): Promise<ProviderRefund | null>;
  settlements(subaccountId: string): Promise<Record<string, unknown>[]>;
  subaccount(id: string): Promise<Record<string, unknown>>;
}
export function decimalToMinor(value: unknown): number {
  const input = String(value);
  if (!/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(input))
    throw new Error('Provider amount must have at most two decimal places.');
  const [whole = '0', fraction = ''] = input.split('.');
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Provider amount is too large.');
  return Number(amount);
}
export function minorToDecimal(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid minor-unit amount.');
  const exact = BigInt(value);
  return `${exact / 100n}.${(exact % 100n).toString().padStart(2, '0')}`;
}
export function validWebhookSecret(value: string | undefined, expected: string): boolean {
  if (!value || !expected) return false;
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Provider returned an invalid object.');
  return value as Record<string, unknown>;
};
/** Node24 preserves the original numeric token, including precision JSON.parse would round. */
export function parseProviderJson(source: string): unknown {
  const parse = JSON.parse as (
    text: string,
    reviver: (key: string, value: unknown, context?: { source?: string }) => unknown,
  ) => unknown;
  return parse(source, (_key, value, context) =>
    typeof value === 'number' && context?.source ? context.source : value,
  );
}
function providerIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,39}$/.test(value))
    throw new Error('Provider returned an invalid identifier.');
  return value;
}
const refundResult = (data: Record<string, unknown>): ProviderRefund => ({
  id: providerIdentifier(data.id),
  status: String(data.status),
  amountMinor: decimalToMinor(data.amount_refunded ?? data.AmountRefunded ?? 0),
});

export class FlutterwaveProvider implements PaymentProvider {
  mode = 'flutterwave' as const;
  key: string;
  transport: typeof fetch;
  constructor(key: string, transport: typeof fetch = fetch) {
    this.key = key;
    this.transport = transport;
  }
  async request(path: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await this.transport(`https://api.flutterwave.com/v3${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const result = record(parseProviderJson(await response.text()));
    if (!response.ok || result.status !== 'success')
      throw new Error(
        'Flutterwave request did not succeed; reconcile the operation before retrying financial effects.',
      );
    return result;
  }
  async checkout(input: ProviderCheckout): Promise<string> {
    const expiresAt = input.expiresAt ?? new Date(Date.now() + 15 * 60000).toISOString();
    const remainingMinutes = Math.floor((Date.parse(expiresAt) - Date.now()) / 60000);
    if (remainingMinutes < 1)
      throw new Error('The inventory hold is too close to expiry for a new checkout.');
    const result = await this.request('/payments', {
      tx_ref: input.reference,
      amount: minorToDecimal(input.amountMinor),
      currency: input.currency,
      redirect_url: input.redirectUrl,
      customer: { email: input.email, name: input.displayName },
      customizations: { title: '7even', description: 'Your hospitality reservation' },
      link_expiration: expiresAt,
      configurations: { session_duration: Math.min(1440, remainingMinutes), max_retry_attempt: 3 },
      subaccounts: [
        {
          id: input.subaccountId,
          transaction_charge_type: 'flat',
          transaction_charge: minorToDecimal(input.commissionMinor),
        },
      ],
    });
    const link = String(record(result.data).link);
    if (!link.startsWith('https://checkout.flutterwave.com/'))
      throw new Error('Unexpected checkout destination.');
    return link;
  }
  async verify(reference: string, transactionId?: string): Promise<ProviderReceipt> {
    if (transactionId && !/^\d+$/.test(transactionId))
      throw new Error('Invalid provider transaction identifier.');
    const result = await this.request(
      transactionId
        ? `/transactions/${transactionId}/verify`
        : `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    );
    const data = record(result.data);
    return {
      id: providerIdentifier(data.id),
      reference: String(data.tx_ref),
      status: String(data.status),
      currency: String(data.currency),
      amountMinor: decimalToMinor(data.amount),
      feeMinor: decimalToMinor(data.app_fee ?? 0),
    };
  }
  async refund(
    transactionId: string,
    amountMinor: number,
    reason: string,
  ): Promise<ProviderRefund> {
    return refundResult(
      record(
        (
          await this.request(`/transactions/${encodeURIComponent(transactionId)}/refund`, {
            amount: minorToDecimal(amountMinor),
            comments: reason,
          })
        ).data,
      ),
    );
  }
  async refundStatus(id: string): Promise<ProviderRefund> {
    return refundResult(record((await this.request(`/refunds/${encodeURIComponent(id)}`)).data));
  }
  async settlements(subaccountId: string): Promise<Record<string, unknown>[]> {
    const data = (
      await this.request(`/settlements?subaccount_id=${encodeURIComponent(subaccountId)}`)
    ).data;
    if (!Array.isArray(data)) throw new Error('Invalid settlements response.');
    const details: Record<string, unknown>[] = [];
    for (const entry of data.slice(0, 5)) {
      const summary = record(entry);
      const detail = record(
        (await this.request(`/settlements/${encodeURIComponent(String(summary.id))}`)).data,
      );
      details.push({ ...detail, queriedSubaccount: subaccountId });
    }
    return details;
  }
  async subaccount(id: string): Promise<Record<string, unknown>> {
    for (let page = 1; page <= 10; page++) {
      const result = await this.request(`/subaccounts?page=${page}`);
      if (!Array.isArray(result.data)) throw new Error('Invalid subaccounts response.');
      const found = result.data.map(record).find((account) => String(account.subaccount_id) === id);
      if (found) return found;
      const pages = Number(record(record(result.meta).page_info).total_pages);
      if (!Number.isSafeInteger(pages) || page >= pages) break;
    }
    throw new Error('Subaccount was not found in the bounded provider account lookup.');
  }
}

/** Explicit development double. It does not contact Flutterwave or simulate bank settlement. */
export class MockProvider implements PaymentProvider {
  mode = 'mock' as const;
  receipts = new Map<string, ProviderReceipt>();
  refunds = new Map<string, ProviderRefund>();
  checkout(input: ProviderCheckout): Promise<string> {
    return Promise.resolve(`/checkout/test/${input.reference.replace('seven-', '')}`);
  }
  verify(reference: string): Promise<ProviderReceipt> {
    const receipt = this.receipts.get(reference);
    if (!receipt) return Promise.reject(new Error('Local test payment has not been completed.'));
    return Promise.resolve(receipt);
  }
  refund(transactionId: string, amountMinor: number): Promise<ProviderRefund> {
    const result = {
      id: `local-refund-${transactionId}`,
      status: 'completed-bank-transfer',
      amountMinor,
    };
    this.refunds.set(result.id, result);
    return Promise.resolve(result);
  }
  refundStatus(id: string): Promise<ProviderRefund> {
    const result = this.refunds.get(id);
    return result
      ? Promise.resolve(result)
      : Promise.reject(new Error('Unknown local test refund.'));
  }
  settlements(): Promise<Record<string, unknown>[]> {
    return Promise.resolve([]);
  }
  subaccount(id: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ subaccount_id: id, is_mock: true });
  }
}
