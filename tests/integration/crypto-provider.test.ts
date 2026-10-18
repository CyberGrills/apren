import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeFunctionData, encodeEventTopics, parseAbi, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  BaseCryptoGateway,
  MockCryptoGateway,
  USDC_ADDRESSES,
  buildBusinessWalletMessage,
  verifyEoaSignature,
  type CryptoQuoteData,
  type CryptoTransferIntent,
} from '../../services/platform/src/cryptoProvider.ts';

const clock = () => new Date('2026-10-18T10:00:00.000Z');
const payer = privateKeyToAccount(`0x${'01'.padStart(64, '0')}`);
const merchant = '0x2222222222222222222222222222222222222222';
const other = '0x3333333333333333333333333333333333333333';
const hash = `0x${'a'.repeat(64)}`;
const blockHash = `0x${'b'.repeat(64)}`;
const previousHash = `0x${'c'.repeat(64)}`;
const transferAbi = parseAbi(['function transfer(address to, uint256 value) returns (bool)']);
const eventAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
const hex = (value: bigint | number) => `0x${BigInt(value).toString(16)}`;
const quoteInput = () => ({
  reference: 'seven-crypto-fixture',
  amountMinor: '1000000',
  payerAddress: payer.address,
  recipientAddress: merchant,
  expiresAt: new Date(clock().getTime() + 10 * 60_000).toISOString(),
});

type RpcFixture = {
  chainId?: number;
  finalized?: bigint;
  receipt?: boolean;
  status?: '0x1' | '0x0';
  from?: Address;
  to?: Address;
  token?: Address;
  amount?: bigint;
  logAmount?: bigint;
  input?: string;
  blockNumber?: bigint;
  blockHash?: string;
  canonicalHash?: string;
  timestamp?: number;
  logs?: boolean;
  duplicateLog?: boolean;
};

function block(number: bigint, hashValue: string, timestamp: number) {
  return {
    number: hex(number),
    hash: hashValue,
    parentHash: previousHash,
    timestamp: hex(timestamp),
    transactions: [],
    gasLimit: '0x1',
    gasUsed: '0x1',
    miner: merchant,
    difficulty: '0x0',
    extraData: '0x',
    size: '0x1',
    nonce: '0x0000000000000000',
    logsBloom: `0x${'0'.repeat(512)}`,
    receiptsRoot: previousHash,
    stateRoot: previousHash,
    transactionsRoot: previousHash,
    sha3Uncles: previousHash,
    uncles: [],
    mixHash: previousHash,
  };
}

function rpcTransport(fixture: RpcFixture = {}): typeof fetch {
  return async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as {
      id: number;
      method: string;
      params: unknown[];
    };
    const amount = fixture.amount ?? 6_666_667n;
    const from = fixture.from ?? payer.address;
    const to = fixture.to ?? merchant;
    const token = fixture.token ?? USDC_ADDRESSES[8453];
    const number = fixture.blockNumber ?? 101n;
    const minedHash = fixture.blockHash ?? blockHash;
    const timestamp = fixture.timestamp ?? Math.floor(clock().getTime() / 1000) + 1;
    const topics = encodeEventTopics({ abi: eventAbi, eventName: 'Transfer', args: { from, to } });
    const log = {
      address: token,
      topics,
      data: `0x${(fixture.logAmount ?? amount).toString(16).padStart(64, '0')}`,
      blockNumber: hex(number),
      blockHash: minedHash,
      transactionHash: hash,
      transactionIndex: '0x0',
      logIndex: '0x0',
      removed: false,
    };
    let result: unknown;
    if (request.method === 'eth_chainId') result = hex(fixture.chainId ?? 8453);
    else if (request.method === 'eth_getBlockByNumber') {
      const tag = request.params[0];
      result =
        tag === 'latest'
          ? block(100n, previousHash, Math.floor(clock().getTime() / 1000))
          : tag === 'finalized'
            ? block(fixture.finalized ?? 101n, blockHash, timestamp)
            : block(number, fixture.canonicalHash ?? minedHash, timestamp);
    } else if (request.method === 'eth_getTransactionReceipt') {
      result =
        fixture.receipt === false
          ? null
          : {
              transactionHash: hash,
              blockNumber: hex(number),
              blockHash: minedHash,
              status: fixture.status ?? '0x1',
              from,
              to: token,
              cumulativeGasUsed: '0x100',
              gasUsed: '0x100',
              effectiveGasPrice: '0x1',
              transactionIndex: '0x0',
              type: '0x2',
              contractAddress: null,
              logsBloom: `0x${'0'.repeat(512)}`,
              logs: fixture.logs === false ? [] : fixture.duplicateLog ? [log, log] : [log],
            };
    } else if (request.method === 'eth_getTransactionByHash') {
      result = {
        hash,
        from,
        to: token,
        blockNumber: hex(number),
        blockHash: minedHash,
        chainId: hex(fixture.chainId ?? 8453),
        value: '0x0',
        nonce: '0x1',
        transactionIndex: '0x0',
        gas: '0x10000',
        gasPrice: '0x1',
        type: '0x2',
        input:
          fixture.input ??
          encodeFunctionData({ abi: transferAbi, functionName: 'transfer', args: [to, amount] }),
        r: previousHash,
        s: previousHash,
        v: '0x1b',
      };
    } else throw new Error(`Unexpected RPC method: ${request.method}`);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
  };
}

function rateTransport(rate = '1500', headers: HeadersInit = {}): typeof fetch {
  return async (_url, init) => {
    assert.equal(init?.cache, 'no-store');
    return new Response(JSON.stringify({ data: { currency: 'USDC', rates: { NGN: rate } } }), {
      headers: { Date: clock().toUTCString(), Age: '0', ...headers },
    });
  };
}

function gateway(fixture: RpcFixture = {}, rates: typeof fetch = rateTransport()) {
  return new BaseCryptoGateway({
    rpcUrl: 'https://rpc.example.test',
    chainId: 8453,
    transport: rpcTransport(fixture),
    rateTransport: rates,
    clock,
  });
}

async function prepared(fixture: RpcFixture = {}): Promise<[BaseCryptoGateway, CryptoQuoteData]> {
  const provider = gateway(fixture);
  return [provider, await provider.prepare(quoteInput())];
}

test('crypto quotation uses exact decimal arithmetic and rounds upward by an atomic USDC unit', async () => {
  const [, quote] = await prepared();
  assert.equal(quote.amountAtoms, '6666667');
  assert.equal(quote.rateNgnPerUsdc, '1500');
  assert.equal(quote.decimals, 6);
  assert.equal(quote.anchorBlock, '100');
  assert.equal(quote.tokenAddress.toLowerCase(), USDC_ADDRESSES[8453]?.toLowerCase());
  assert.match(quote.rateSource, /Coinbase.*indicative/i);
  assert.equal(quote.createdAt, clock().toISOString());
  assert.ok(Date.parse(quote.expiresAt) <= clock().getTime() + 5 * 60_000);
  assert.match(quote.message, /seven-crypto-fixture/);
  assert.match(quote.message, /6666667/);
});

test('crypto quotation does not round a precise source rate through JavaScript floating point', async () => {
  const provider = gateway({}, rateTransport('0.1000000000000000001'));
  const quote = await provider.prepare({ ...quoteInput(), amountMinor: '100000000000000001' });
  assert.equal(quote.amountAtoms, '10000000000000000090000');
});

for (const amountMinor of ['0', '-1', '1.5', '01', '1e4', '9'.repeat(19)]) {
  test(`crypto quotation rejects malformed or oversized NGN minor units ${amountMinor}`, async () => {
    await assert.rejects(gateway().prepare({ ...quoteInput(), amountMinor }), /amount/i);
  });
}

for (const rate of ['0', '-1', 'NaN', '1e3', '0.0', '']) {
  test(`crypto quotation rejects unusable indicative rates ${JSON.stringify(rate)}`, async () => {
    await assert.rejects(gateway({}, rateTransport(rate)).prepare(quoteInput()), /rate/i);
  });
}

test('crypto quotation rejects cached rates beyond its HTTP freshness allowance', async () => {
  await assert.rejects(
    gateway({}, rateTransport('1500', { Age: '61' })).prepare(quoteInput()),
    /fresh|cache|rate/i,
  );
});

test('crypto quotation rejects old source Date headers', async () => {
  const date = new Date(clock().getTime() - 120_000).toUTCString();
  await assert.rejects(
    gateway({}, rateTransport('1500', { Date: date })).prepare(quoteInput()),
    /fresh|date|rate/i,
  );
});

test('crypto quotation rejects responses without source Date headers', async () => {
  const rates: typeof fetch = async () =>
    new Response(' {"data":{"currency":"USDC","rates":{"NGN":"1500"}}}');
  await assert.rejects(gateway({}, rates).prepare(quoteInput()), /date|fresh|rate/i);
});

test('crypto quotation requires the configured RPC chain', async () => {
  await assert.rejects(gateway({ chainId: 1 }).prepare(quoteInput()), /chain|network/i);
});

test('unconfigured crypto RPC leaves fiat operation possible but disables crypto requests', async () => {
  const provider = new BaseCryptoGateway({ rpcUrl: '', chainId: 84532 });
  assert.equal(provider.enabled, false);
  await assert.rejects(provider.prepare(quoteInput()), /unavailable|configured/i);
});

test('crypto RPC requires encrypted transport except development loopback nodes', () => {
  for (const rpcUrl of ['http://rpc.example.test', 'ws://localhost:8545', 'file:///tmp/rpc']) {
    assert.throws(() => new BaseCryptoGateway({ rpcUrl, chainId: 84532 }), /HTTPS/i);
  }
  assert.equal(
    new BaseCryptoGateway({ rpcUrl: 'https://rpc.example.test', chainId: 84532 }).enabled,
    true,
  );
  if (process.env.NODE_ENV !== 'production') {
    for (const rpcUrl of ['http://127.0.0.1:8545', 'http://localhost:8545', 'http://[::1]:8545'])
      assert.equal(new BaseCryptoGateway({ rpcUrl, chainId: 84532 }).enabled, true);
  }
});

test('a fresh HTTP response containing another currency cannot quote USDC', async () => {
  const rate: typeof fetch = async () =>
    new Response('{"data":{"currency":"USD","rates":{"NGN":"1500"}}}', {
      headers: { Date: clock().toUTCString() },
    });
  await assert.rejects(gateway({}, rate).prepare(quoteInput()), /rate/i);
});

test('numeric exchange-rate tokens are rejected instead of parsed through a floating-point number', async () => {
  const rate: typeof fetch = async () =>
    new Response('{"data":{"currency":"USDC","rates":{"NGN":1500.0000000000000001}}}', {
      headers: { Date: clock().toUTCString() },
    });
  await assert.rejects(gateway({}, rate).prepare(quoteInput()), /rate/i);
});

test('a failed rate service does not create a made-up fallback quote', async () => {
  const rate: typeof fetch = async () => new Response('unavailable', { status: 503 });
  await assert.rejects(gateway({}, rate).prepare(quoteInput()), /rate/i);
});

test('crypto gateway rejects unsupported networks at construction', () => {
  assert.throws(
    () => new BaseCryptoGateway({ rpcUrl: 'https://rpc.example.test', chainId: 1 }),
    /Base/i,
  );
});

test('crypto quotation rejects zero or malformed recipients and expired holds', async () => {
  await assert.rejects(
    gateway().prepare({ ...quoteInput(), recipientAddress: `0x${'0'.repeat(40)}` }),
    /wallet|address/i,
  );
  await assert.rejects(
    gateway().prepare({ ...quoteInput(), payerAddress: 'wrong' }),
    /wallet|address/i,
  );
  await assert.rejects(
    gateway().prepare({ ...quoteInput(), expiresAt: clock().toISOString() }),
    /expir/i,
  );
});

test('only the quoted EOA can prove ownership of the payment wallet', async () => {
  const [provider, quote] = await prepared();
  const signature = await payer.signMessage({ message: quote.message });
  assert.equal(await provider.verifySignature(quote, signature), true);
  assert.equal(
    await provider.verifySignature({ ...quote, recipientAddress: other }, signature),
    false,
  );
  assert.equal(await provider.verifySignature({ ...quote, amountAtoms: '1' }, signature), false);
  assert.equal(await provider.verifySignature({ ...quote, reference: 'other' }, signature), false);
  assert.equal(await provider.verifySignature(quote, '0xbroken'), false);
});

test('wallet proof from another supported network cannot authorize the configured gateway', async () => {
  const provider = gateway();
  const otherNetwork = new MockCryptoGateway({ clock, chainId: 84532 });
  const quote = await otherNetwork.prepare(quoteInput());
  const signature = await payer.signMessage({ message: quote.message });
  assert.equal(await provider.verifySignature(quote, signature), false);
});

test('RPC credential-bearing errors never escape through quotation failures', async () => {
  const transport: typeof fetch = async () => {
    throw new Error('Synthetic URL https://rpc.example.test/private-api-key-must-not-leak');
  };
  const provider = new BaseCryptoGateway({
    rpcUrl: 'https://rpc.example.test',
    chainId: 8453,
    transport,
    rateTransport: rateTransport(),
    clock,
  });
  await assert.rejects(provider.prepare(quoteInput()), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /private-api-key|rpc.example.test/);
    return true;
  });
});

test('business wallet proofs bind the venue, wallet, nonce, network and expiry', async () => {
  const input = {
    reference: 'challenge-123',
    venueId: 'venue-fixture',
    chainId: 8453,
    walletAddress: payer.address,
    expiresAt: quoteInput().expiresAt,
  };
  const message = buildBusinessWalletMessage(input);
  const signature = await payer.signMessage({ message });
  assert.equal(await verifyEoaSignature({ address: payer.address, message, signature }), true);
  assert.equal(
    await verifyEoaSignature({
      address: payer.address,
      message: buildBusinessWalletMessage({ ...input, venueId: 'other-venue' }),
      signature,
    }),
    false,
  );
});

test('exact direct USDC transfer is accepted only after canonical finality', async () => {
  const [provider, quote] = await prepared();
  const result = await provider.verify(quote, hash);
  assert.equal(result.status, 'successful');
  assert.equal(result.transactionId, hash);
  assert.equal(result.amountAtoms, quote.amountAtoms);
  assert.equal(result.from.toLowerCase(), payer.address.toLowerCase());
  assert.equal(result.to.toLowerCase(), merchant);
  assert.equal(result.blockNumber, '101');
  assert.equal(result.blockHash, blockHash);
});

test('a mined transfer stays pending until the node finalized height reaches its block', async () => {
  const [provider, quote] = await prepared({ finalized: 100n });
  assert.equal((await provider.verify(quote, hash)).status, 'pending');
});

test('missing transaction receipt remains pending without inventing successful settlement', async () => {
  const [provider, quote] = await prepared({ receipt: false });
  assert.equal((await provider.verify(quote, hash)).status, 'pending');
});

test('read-only RPC transport failures leave verification uncertain with a bounded error', async () => {
  const [, quote] = await prepared();
  let failures = 0;
  const transport: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string };
    if (body.method === 'eth_chainId')
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x2105' }));
    failures++;
    throw new Error('Synthetic transport failure');
  };
  const provider = new BaseCryptoGateway({
    rpcUrl: 'https://rpc.example.test',
    chainId: 8453,
    transport,
    rateTransport: rateTransport(),
    clock,
  });
  await assert.rejects(provider.verify(quote, hash), /could not be checked|reconcile/i);
  assert.ok(failures >= 1 && failures <= 2);
});

test('a reorged receipt remains pending for reconciliation', async () => {
  const [provider, quote] = await prepared({ canonicalHash: previousHash });
  assert.equal((await provider.verify(quote, hash)).status, 'pending');
});

for (const [label, fixture] of [
  ['failed receipt', { status: '0x0' }],
  ['wrong payer', { from: other }],
  ['wrong recipient', { to: other }],
  ['wrong token', { token: other }],
  ['underpayment', { amount: 6_666_666n }],
  ['overpayment', { amount: 6_666_668n }],
  ['mismatched transfer log amount', { logAmount: 1n }],
  ['missing transfer log', { logs: false }],
  ['duplicate transfer log', { duplicateLog: true }],
  ['old transaction before quote anchor', { blockNumber: 99n }],
  ['transaction in the quote anchor block', { blockNumber: 100n }],
  [
    'late transaction after quote expiry',
    { timestamp: Math.floor(clock().getTime() / 1000) + 6 * 60 },
  ],
  ['different contract call', { input: '0x12345678' }],
] as const) {
  test(`crypto verification sends ${label} to review`, async () => {
    const [provider, quote] = await prepared(fixture);
    const result = await provider.verify(quote, hash);
    assert.equal(result.status, 'review');
    assert.ok(result.exception);
  });
}

test('crypto verification rejects a different chain even when its receipt looks valid', async () => {
  const [, quote] = await prepared();
  const wrongChain = gateway({ chainId: 1 });
  await assert.rejects(wrongChain.verify(quote, hash), /chain|network/i);
});

test('crypto verification rejects a malformed transaction hash before RPC lookup', async () => {
  const [provider, quote] = await prepared();
  await assert.rejects(provider.verify(quote, 'not-a-hash'), /hash/i);
});

test('mock crypto evidence requires explicit local completion and keeps signatures verifiable', async () => {
  const provider = new MockCryptoGateway({ clock });
  const quote = await provider.prepare(quoteInput());
  const signature = await payer.signMessage({ message: quote.message });
  assert.equal(provider.mode, 'mock');
  assert.equal(await provider.verifySignature(quote, signature), true);
  assert.equal((await provider.verify(quote, hash)).status, 'pending');
  provider.complete(quote, hash);
  assert.equal((await provider.verify(quote, hash)).status, 'successful');
});

test('mock crypto completion cannot attach a recorded transaction to another quote', async () => {
  const provider = new MockCryptoGateway({ clock });
  const quote = await provider.prepare(quoteInput());
  const otherQuote = await provider.prepare({ ...quoteInput(), reference: 'other-reference' });
  provider.complete(quote, hash);
  assert.throws(() => provider.complete(otherQuote, hash), /another quote/i);
  assert.equal((await provider.verify(otherQuote, hash)).status, 'pending');
  assert.equal(provider.complete(quote, hash), hash);
});

test('a merchant return verifies against its exact transfer intent without a new FX quotation', async () => {
  const [provider, quote] = await prepared({ from: merchant, to: payer.address });
  const intent: CryptoTransferIntent = {
    ...quote,
    reference: 'refund:fixture',
    payerAddress: quote.recipientAddress,
    recipientAddress: quote.payerAddress,
    createdAt: new Date(clock().getTime() - 60_000).toISOString(),
    expiresAt: new Date(clock().getTime() + 29 * 86_400_000).toISOString(),
  };
  assert.equal((await provider.verifyReturn(intent, hash)).status, 'successful');
});

test('mock returns can complete after the original five-minute payment quote expired', async () => {
  const provider = new MockCryptoGateway({ clock });
  const quote = await provider.prepare(quoteInput());
  const intent: CryptoTransferIntent = {
    ...quote,
    reference: 'refund:fixture',
    createdAt: new Date(clock().getTime() - 86_400_000).toISOString(),
    expiresAt: new Date(clock().getTime() + 29 * 86_400_000).toISOString(),
    payerAddress: quote.recipientAddress,
    recipientAddress: quote.payerAddress,
  };
  const returnHash = provider.completeReturn(intent);
  assert.equal((await provider.verifyReturn(intent, returnHash)).status, 'successful');
  assert.equal((await provider.verify(quote, returnHash)).status, 'pending');
});

for (const [label, changes, fixture] of [
  ['wrong business sender', { payerAddress: other }, {}],
  ['wrong customer recipient', { recipientAddress: other }, {}],
  ['old return before instructions', {}, { timestamp: Math.floor(clock().getTime() / 1000) - 1 }],
] as const) {
  test(`merchant return verification sends ${label} to review`, async () => {
    const [provider, quote] = await prepared(fixture);
    assert.equal(
      (await provider.verifyReturn({ ...quote, reference: 'refund:fixture', ...changes }, hash))
        .status,
      'review',
    );
  });
}

test('return intents reject different token contracts and periods longer than thirty days', async () => {
  const [provider, quote] = await prepared();
  await assert.rejects(
    provider.verifyReturn({ ...quote, reference: 'refund:fixture', tokenAddress: other }, hash),
    /token|network/i,
  );
  await assert.rejects(
    provider.verifyReturn(
      {
        ...quote,
        reference: 'refund:fixture',
        expiresAt: new Date(clock().getTime() + 31 * 86_400_000).toISOString(),
      },
      hash,
    ),
    /expir|time/i,
  );
});
