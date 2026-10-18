import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fiatPaymentRoute } from '../src/paymentRouting.ts';

for (const [amount, provider] of [
  ['4999999', 'paystack'],
  ['5000000', 'paystack'],
  ['5000001', 'flutterwave'],
  ['999999999999999', 'flutterwave'],
] as const) {
  test(`${amount} kobo routes to ${provider}`, () => {
    assert.equal(fiatPaymentRoute(amount).provider, provider);
    assert.equal(fiatPaymentRoute(amount).policyVersion, 'ngn-50000-v1');
  });
}
for (const amount of ['0', '-1', '1.1', '1e4', '01', '1000000000000000']) {
  test(`routing rejects invalid payable total ${amount}`, () =>
    assert.throws(() => fiatPaymentRoute(amount)));
}
