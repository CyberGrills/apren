import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decimalToMinor,
  minorToDecimal,
  validWebhookSecret,
  FlutterwaveProvider,
  parseProviderJson,
} from '../../services/platform/src/provider.ts';

test('provider amounts convert exact decimal values and reject non-kobo precision', () => {
  assert.equal(decimalToMinor('123.45'), 12345);
  assert.equal(minorToDecimal(1005), '10.05');
  assert.throws(() => decimalToMinor('1.005'));
  assert.throws(() => decimalToMinor('-1'));
  assert.equal(validWebhookSecret('correct', 'correct'), true);
  assert.equal(validWebhookSecret('wrong', 'correct'), false);
  assert.equal(validWebhookSecret(undefined, ''), false);
});

test('provider JSON retains sub-kobo tokens rather than rounding them into valid payments', async () => {
  const parsed = parseProviderJson('{"amount":1.0000000000000001}') as { amount: string };
  assert.equal(parsed.amount, '1.0000000000000001');
  assert.throws(() => decimalToMinor(parsed.amount));
  const provider = new FlutterwaveProvider(
    'test',
    async () =>
      new Response(
        '{"status":"success","data":{"id":123,"tx_ref":"test-ref","status":"successful","currency":"NGN","amount":1.0000000000000001,"app_fee":0}}',
      ),
  );
  await assert.rejects(provider.verify('test-ref'), /decimal/);
});

test('Flutterwave hosted checkout freezes server commission as flat service commission', async () => {
  let sent: {
    amount?: string;
    subaccounts?: unknown;
    link_expiration?: string;
    configurations?: { session_duration: number };
  } = {};
  const provider = new FlutterwaveProvider('test-key', async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        status: 'success',
        data: { link: 'https://checkout.flutterwave.com/test' },
      }),
    );
  });
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
  await provider.checkout({
    reference: 'seven:test',
    amountMinor: 11000,
    commissionMinor: 1000,
    currency: 'NGN',
    subaccountId: 'RS_TEST',
    email: 'sample@example.test',
    displayName: 'Test Guest',
    redirectUrl: 'https://seven.example/return',
    expiresAt,
  });
  assert.equal(sent.amount, '110.00');
  assert.deepEqual(sent.subaccounts, [
    { id: 'RS_TEST', transaction_charge_type: 'flat', transaction_charge: '10.00' },
  ]);
  assert.equal(sent.link_expiration, expiresAt);
  assert.ok(sent.configurations);
  assert.ok(sent.configurations.session_duration >= 4 && sent.configurations.session_duration <= 5);
  await assert.rejects(
    provider.checkout({
      reference: 'expired-fixture',
      amountMinor: 100,
      commissionMinor: 10,
      currency: 'NGN',
      subaccountId: 'RS_TEST',
      email: 'sample@example.test',
      displayName: 'Test Guest',
      redirectUrl: 'https://seven.example/return',
      expiresAt: new Date(Date.now() + 30000).toISOString(),
    }),
    /close to expiry/,
  );
});

test('provider success payloads cannot invent missing transaction or refund identities', async () => {
  const refund = new FlutterwaveProvider(
    'test',
    async () =>
      new Response(
        '{"status":"success","data":{"status":"completed-bank-transfer","amount_refunded":100}}',
      ),
  );
  await assert.rejects(refund.refund('123', 10000, 'Synthetic fixture'), /identifier/);
  const payment = new FlutterwaveProvider(
    'test',
    async () =>
      new Response(
        '{"status":"success","data":{"tx_ref":"test-reference","status":"successful","currency":"NGN","amount":100}}',
      ),
  );
  await assert.rejects(payment.verify('test-reference'), /identifier/);
});
