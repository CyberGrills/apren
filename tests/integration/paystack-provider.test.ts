import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  PaystackProvider,
  validPaystackWebhook,
} from '../../services/platform/src/paystackProvider.ts';
import type { ProviderCheckout } from '../../services/platform/src/provider.ts';

const checkoutInput = (): ProviderCheckout => ({
  reference: 'seven-0259c894-6eaa-4291-a920-cdb122f0e278',
  amountMinor: 11000,
  commissionMinor: 1000,
  currency: 'NGN',
  subaccountId: 'ACCT_business123',
  email: 'guest@example.test',
  displayName: 'Sample Guest',
  redirectUrl: 'https://seven.example/payment/return',
  expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
});

const reply = (data: unknown, extra: Record<string, unknown> = {}): Response =>
  new Response(JSON.stringify({ status: true, data, ...extra }));

const checkoutReply = (input = checkoutInput()): Response =>
  reply({
    reference: input.reference,
    authorization_url: 'https://checkout.paystack.com/sample123',
    access_code: 'sample123',
  });

test('Paystack checkout uses exact kobo and the saved commission while the business bears fees', async () => {
  const input = checkoutInput();
  let sent: RequestInit | undefined;
  const provider = new PaystackProvider('fixture-key', async (url, init) => {
    assert.equal(url, 'https://api.paystack.co/transaction/initialize');
    sent = init;
    return checkoutReply(input);
  });
  assert.equal(await provider.checkout(input), 'https://checkout.paystack.com/sample123');
  assert.equal(sent?.method, 'POST');
  assert.equal(sent?.redirect, 'error');
  assert.deepEqual(sent?.headers, {
    Authorization: 'Bearer fixture-key',
    'Content-Type': 'application/json',
  });
  assert.deepEqual(JSON.parse(String(sent?.body)), {
    reference: input.reference,
    amount: '11000',
    currency: 'NGN',
    email: input.email,
    callback_url: input.redirectUrl,
    subaccount: input.subaccountId,
    transaction_charge: 1000,
    bearer: 'subaccount',
  });
});

test('Paystack rejects invalid money, references, accounts and expired holds before dispatch', async () => {
  let calls = 0;
  const provider = new PaystackProvider('fixture-key', async () => {
    calls++;
    return checkoutReply();
  });
  const invalid: Partial<ProviderCheckout>[] = [
    { amountMinor: 0 },
    { amountMinor: -100 },
    { amountMinor: 100.5 },
    { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
    { commissionMinor: -1 },
    { commissionMinor: 0.5 },
    { commissionMinor: 11000 },
    { currency: 'USD' },
    { reference: 'seven:invalid' },
    { subaccountId: 'ACCT_../other' },
    { redirectUrl: 'javascript:alert(1)' },
    { expiresAt: 'invalid-date' },
    { expiresAt: new Date(Date.now() + 30000).toISOString() },
  ];
  for (const change of invalid)
    await assert.rejects(provider.checkout({ ...checkoutInput(), ...change }));
  assert.equal(calls, 0);
});

test('Paystack checkout does not trust provider envelope, reference or checkout destination', async () => {
  const input = checkoutInput();
  for (const authorization_url of [
    'http://checkout.paystack.com/sample123',
    'https://checkout.paystack.com.evil.example/sample123',
    'https://checkout.paystack.com@evil.example/sample123',
    'https://name@checkout.paystack.com/sample123',
    'https://checkout.paystack.com:444/sample123',
    'https://checkout.paystack.com/',
  ]) {
    const provider = new PaystackProvider('fixture-key', async () =>
      reply({ reference: input.reference, authorization_url, access_code: 'sample123' }),
    );
    await assert.rejects(provider.checkout(input), /checkout destination/);
  }
  const mismatch = new PaystackProvider('fixture-key', async () =>
    reply({
      reference: 'another-reference',
      authorization_url: 'https://checkout.paystack.com/sample123',
      access_code: 'sample123',
    }),
  );
  await assert.rejects(mismatch.checkout(input), /reference/);
  for (const response of [
    new Response('{"status":"true","data":{}}'),
    new Response('{"status":false,"data":{}}'),
    new Response('{"status":true,"data":[] }'),
    new Response('{"status":true,"data":{}}', { status: 503 }),
    new Response('not-json'),
  ]) {
    const provider = new PaystackProvider('fixture-key', async () => response);
    await assert.rejects(provider.checkout(input));
  }
});

test('Paystack verification preserves uint64 identifiers and integer kobo without rescaling', async () => {
  const provider = new PaystackProvider('fixture-key', async (url) => {
    assert.equal(url, 'https://api.paystack.co/transaction/verify/seven-valid');
    return new Response(
      '{"status":true,"data":{"id":18446744073709551615,"reference":"seven-valid","status":"success","currency":"NGN","amount":11000,"fees":165}}',
    );
  });
  assert.deepEqual(await provider.verify('seven-valid', '18446744073709551615'), {
    id: '18446744073709551615',
    reference: 'seven-valid',
    status: 'successful',
    currency: 'NGN',
    amountMinor: 11000,
    feeMinor: 165,
  });
});

test('Paystack verification rejects mismatched references, IDs and non-integer provider amounts', async () => {
  const base = {
    id: '91',
    reference: 'seven-valid',
    status: 'success',
    currency: 'NGN',
    amount: '11000',
    fees: '165',
  };
  for (const change of [
    { id: undefined },
    { id: '0' },
    { id: '18446744073709551616' },
    { id: '1e3' },
    { reference: 'another-reference' },
    { status: 'made-up' },
    { amount: '11000.0' },
    { amount: '11000.000000000000001' },
    { amount: '-1' },
    { amount: '9007199254740992' },
    { fees: null },
    { fees: '0.5' },
  ]) {
    const provider = new PaystackProvider('fixture-key', async () => reply({ ...base, ...change }));
    await assert.rejects(provider.verify('seven-valid'));
  }
  const provider = new PaystackProvider('fixture-key', async () => reply(base));
  await assert.rejects(provider.verify('seven-valid', '92'), /identifier/);
  const rounded = new PaystackProvider(
    'fixture-key',
    async () =>
      new Response(
        '{"status":true,"data":{"id":91,"reference":"seven-valid","status":"success","currency":"NGN","amount":11000.000000000000001,"fees":165}}',
      ),
  );
  await assert.rejects(rounded.verify('seven-valid'), /minor-unit/);
});

test('Paystack verification preserves every documented non-success status without crediting it', async () => {
  for (const status of [
    'failed',
    'abandoned',
    'ongoing',
    'pending',
    'processing',
    'queued',
    'reversed',
  ]) {
    const provider = new PaystackProvider('fixture-key', async () =>
      reply({
        id: 91,
        reference: 'seven-valid',
        status,
        currency: 'NGN',
        amount: 11000,
        fees: null,
      }),
    );
    assert.equal((await provider.verify('seven-valid')).status, status);
  }
});

test('Paystack refunds use integer kobo and normalize only processed refunds as complete', async () => {
  for (const [status, normalized] of [
    ['processed', 'completed-bank-transfer'],
    ['failed', 'failed'],
    ['pending', 'pending'],
    ['processing', 'pending'],
    ['needs-attention', 'pending'],
  ]) {
    const provider = new PaystackProvider('fixture-key', async (url, init) => {
      assert.equal(url, 'https://api.paystack.co/refund');
      assert.deepEqual(JSON.parse(String(init?.body)), {
        transaction: '91',
        amount: 11000,
        currency: 'NGN',
        merchant_note: 'Sample cancellation',
      });
      return reply({ id: 33, transaction: { id: 91 }, amount: 11000, currency: 'NGN', status });
    });
    assert.deepEqual(await provider.refund('91', 11000, 'Sample cancellation'), {
      id: '33',
      amountMinor: 11000,
      status: normalized,
    });
  }
});

test('Paystack refund lookups bind returned identity and reject malformed financial evidence', async () => {
  const base = { id: '33', amount: '11000', currency: 'NGN', status: 'processed' };
  const provider = new PaystackProvider('fixture-key', async (url) => {
    assert.equal(url, 'https://api.paystack.co/refund/33');
    return reply(base);
  });
  assert.equal((await provider.refundStatus('33')).status, 'completed-bank-transfer');
  for (const change of [
    { id: undefined },
    { id: '34' },
    { amount: '110.00' },
    { amount: '-100' },
    { currency: 'USD' },
    { status: 'success' },
  ]) {
    const invalid = new PaystackProvider('fixture-key', async () => reply({ ...base, ...change }));
    await assert.rejects(invalid.refundStatus('33'));
  }
  const mismatch = new PaystackProvider('fixture-key', async () =>
    reply({ ...base, transaction: { id: '92' } }),
  );
  await assert.rejects(mismatch.refund('91', 11000, 'Sample cancellation'), /transaction/);
  const wrongAmount = new PaystackProvider('fixture-key', async () =>
    reply({ ...base, amount: 10000, transaction: { id: '91' } }),
  );
  await assert.rejects(wrongAmount.refund('91', 11000, 'Sample cancellation'), /amount/);
});

test('Paystack rejects invalid refund amounts before dispatch and never retries an uncertain request', async () => {
  let calls = 0;
  const provider = new PaystackProvider('fixture-key', async () => {
    calls++;
    throw new Error('Simulated provider timeout after accepting the request');
  });
  for (const amount of [0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(provider.refund('91', amount, 'Sample cancellation'), /minor-unit/);
  assert.equal(calls, 0);
  await assert.rejects(provider.refund('91', 11000, 'Sample cancellation'), /timeout/);
  assert.equal(calls, 1);
});

test('Paystack finds one complete matching refund after an uncertain dispatch without refunding again', async () => {
  let calls = 0;
  const provider = new PaystackProvider('fixture-key', async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.paystack.co/refund?transaction=91&perPage=2&page=1');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.body, undefined);
    return reply(
      [{ id: 33, transaction: 91, amount: 11000, currency: 'NGN', status: 'processed' }],
      { meta: { total: 1, page: 1, pageCount: 1 } },
    );
  });
  assert.deepEqual(await provider.findRefund('91', 11000), {
    id: '33',
    amountMinor: 11000,
    status: 'completed-bank-transfer',
  });
  assert.equal(calls, 1);
});

test('Paystack refund recovery leaves ambiguous, partial and unrelated refunds unresolved', async () => {
  const refund = { id: 33, transaction: 91, amount: 11000, currency: 'NGN', status: 'processed' };
  const cases: [unknown[], unknown][] = [
    [[], { total: 0, page: 1, pageCount: 0 }],
    [[refund, { ...refund, id: 34 }], { total: 2, page: 1, pageCount: 1 }],
    [[refund], { total: 2, page: 1, pageCount: 1 }],
    [[refund], { total: 1, page: 2, pageCount: 2 }],
    [[refund], undefined],
    [[{ ...refund, amount: 10000 }], { total: 1, page: 1, pageCount: 1 }],
    [[{ ...refund, transaction: 92 }], { total: 1, page: 1, pageCount: 1 }],
    [[{ ...refund, currency: 'USD' }], { total: 1, page: 1, pageCount: 1 }],
  ];
  for (const [data, meta] of cases) {
    const provider = new PaystackProvider('fixture-key', async () => reply(data, { meta }));
    assert.equal(await provider.findRefund('91', 11000), null);
  }
});

test('Paystack subaccount distinguishes bank IDs and names from bank codes', async () => {
  const provider = new PaystackProvider('fixture-key', async (url) => {
    assert.equal(url, 'https://api.paystack.co/subaccount/ACCT_business123');
    return reply({
      id: 91,
      subaccount_code: 'ACCT_business123',
      account_number: '0123456789',
      account_name: 'Sample Business',
      settlement_bank: 'Sample Bank',
      bank: 9,
      active: true,
      is_verified: false,
      currency: 'NGN',
      domain: 'test',
    });
  });
  assert.deepEqual(await provider.subaccount('ACCT_business123'), {
    subaccount_id: 'ACCT_business123',
    providerRawId: '91',
    account_number: '0123456789',
    account_name: 'Sample Business',
    account_bank: null,
    bankName: 'Sample Bank',
    providerBankId: '9',
    country: 'NG',
    currency: 'NGN',
    active: true,
    domain: 'test',
    is_verified: false,
  });
});

test('Paystack subaccount rejects another destination and malformed account metadata', async () => {
  const base = {
    id: 91,
    subaccount_code: 'ACCT_business123',
    account_number: '0123456789',
    account_name: 'Sample Business',
    settlement_bank: 'Sample Bank',
    bank: 9,
    active: true,
    currency: 'NGN',
    domain: 'test',
  };
  for (const change of [
    { subaccount_code: 'ACCT_other' },
    { account_number: '123' },
    { currency: 'USD' },
    { active: 'yes' },
    { domain: 'unknown' },
  ]) {
    const provider = new PaystackProvider('fixture-key', async () => reply({ ...base, ...change }));
    await assert.rejects(provider.subaccount('ACCT_business123'));
  }
});

test('Paystack preserves a real bank code and an inactive subaccount without claiming verification', async () => {
  const provider = new PaystackProvider('fixture-key', async () =>
    reply({
      id: 91,
      subaccount_code: 'ACCT_business123',
      account_number: '0123456789',
      account_name: 'Sample Business',
      settlement_bank: 'Sample Bank',
      bank: 9,
      bank_code: '011',
      active: 0,
      currency: 'NGN',
      domain: 'live',
    }),
  );
  const account = await provider.subaccount('ACCT_business123');
  assert.equal(account.account_bank, '011');
  assert.equal(account.active, false);
  assert.equal(account.is_verified, false);
  assert.equal(account.domain, 'live');
});

test('Paystack settlements join bounded transaction evidence without inventing bank delivery', async () => {
  const calls: string[] = [];
  const provider = new PaystackProvider('fixture-key', async (url) => {
    const value = String(url);
    calls.push(value);
    if (value.endsWith('/subaccount/ACCT_business123'))
      return reply({ id: 91, subaccount_code: 'ACCT_business123' });
    if (value.includes('/settlement?')) {
      const query = new URL(value).searchParams;
      assert.equal(query.get('subaccount'), '91');
      assert.equal(query.get('perPage'), '5');
      return reply(
        [{ id: 38, status: 'success', currency: 'NGN', total_amount: 9835, total_fees: 165 }],
        { meta: { pageCount: 1 } },
      );
    }
    assert.equal(value, 'https://api.paystack.co/settlement/38/transactions?perPage=100&page=1');
    return reply(
      [
        {
          id: 92,
          reference: 'seven-valid',
          status: 'success',
          currency: 'NGN',
          amount: 11000,
          fees: 165,
        },
      ],
      { meta: { pageCount: 2 } },
    );
  });
  const settlements = await provider.settlements('ACCT_business123');
  assert.equal(calls.length, 3);
  assert.equal(settlements.length, 1);
  const settlement = settlements[0];
  assert.ok(settlement);
  assert.equal(settlement.id, '38');
  assert.equal(settlement.status, 'success');
  assert.equal(settlement.queriedSubaccount, 'ACCT_business123');
  assert.equal(settlement.transactionsComplete, false);
  assert.equal(settlement.bankSettlementEvidence, false);
  assert.equal('settlement_account' in settlement, false);
  assert.equal('disburse_ref' in settlement, false);
  assert.equal('destination' in settlement, false);
  assert.deepEqual(settlement.transactions, [
    {
      id: '92',
      reference: 'seven-valid',
      status: 'success',
      currency: 'NGN',
      amount: '11000',
      fees: '165',
    },
  ]);
});

test('Paystack settlement lookups stay bounded even if the provider ignores page size', async () => {
  let transactionRequests = 0;
  const provider = new PaystackProvider('fixture-key', async (url) => {
    if (String(url).endsWith('/subaccount/ACCT_business123'))
      return reply({ id: 91, subaccount_code: 'ACCT_business123' });
    if (String(url).includes('/settlement?'))
      return reply(
        Array.from({ length: 8 }, (_, index) => ({
          id: index + 1,
          currency: 'NGN',
          status: 'success',
          total_amount: 9835,
          total_fees: 165,
        })),
      );
    transactionRequests++;
    return reply(
      Array.from({ length: 101 }, (_, index) => ({
        id: index + 100,
        reference: `seven-${index}`,
        status: 'success',
        currency: 'NGN',
        amount: 11000,
        fees: 165,
      })),
      { meta: { pageCount: 1 } },
    );
  });
  const settlements = await provider.settlements('ACCT_business123');
  assert.equal(settlements.length, 5);
  assert.equal(transactionRequests, 5);
  for (const settlement of settlements) {
    assert.equal((settlement.transactions as unknown[]).length, 100);
    assert.equal(settlement.transactionsComplete, false);
  }
});

test('Paystack webhook authenticates exact raw bytes and rejects missing or malformed signatures', () => {
  const secret = 'sample-webhook-secret';
  const raw = Buffer.from('{"event":"charge.success","data":{"id":91}}');
  const signature = createHmac('sha512', secret).update(raw).digest('hex');
  assert.equal(validPaystackWebhook(raw, signature, secret), true);
  assert.equal(
    validPaystackWebhook(
      Buffer.from('{ "event":"charge.success","data":{"id":91}}'),
      signature,
      secret,
    ),
    false,
  );
  assert.equal(validPaystackWebhook(raw, signature, 'other-secret'), false);
  for (const invalid of [
    undefined,
    '',
    'not-hex',
    '0'.repeat(128),
    signature.slice(1),
    `${signature}00`,
  ])
    assert.equal(validPaystackWebhook(raw, invalid, secret), false);
  assert.equal(validPaystackWebhook(raw, signature, ''), false);
});
