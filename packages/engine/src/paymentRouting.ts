import { parseMinor } from './money.ts';

export const PAYMENT_ROUTING_POLICY = 'ngn-50000-v1';
export const LIGHT_PAYMENT_LIMIT_MINOR = '5000000';
export function fiatPaymentRoute(totalMinor: string): {
  provider: 'paystack' | 'flutterwave';
  policyVersion: string;
} {
  const total = parseMinor(totalMinor);
  if (total <= 0n) throw new Error('The payable amount must be positive.');
  return {
    provider: total > 5_000_000n ? 'flutterwave' : 'paystack',
    policyVersion: PAYMENT_ROUTING_POLICY,
  };
}
