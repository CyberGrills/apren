import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EIP1193Provider } from 'viem';
import {
  connectPaymentWallet,
  formatUsdc,
  prepareUsdcTransfer,
  SAMPLE_PAYER,
  walletRequestRejected,
} from './paymentWallet.ts';

describe('wallet payment display and account boundary', () => {
  it('distinguishes a structured wallet rejection from an uncertain RPC failure', () => {
    assert.equal(walletRequestRejected({ code: 4001 }), true);
    assert.equal(walletRequestRejected({ cause: { cause: { code: 4001 } } }), true);
    assert.equal(walletRequestRejected(new Error('User rejected after a timeout')), false);
    assert.equal(walletRequestRejected({ code: -32000 }), false);
  });
  it('formats exact token atoms without losing six-decimal precision', () => {
    assert.equal(formatUsdc('1'), '0.000001');
    assert.equal(formatUsdc('1000000'), '1.000000');
    assert.equal(formatUsdc('123456789012345678901234567890'), '123456789012345678901234.567890');
    for (const malformed of ['-1', '1.1', '01', '1e6', ' 1', '9'.repeat(79)])
      assert.throws(() => formatUsdc(malformed));
  });
  it('requires the frozen payer and exact Base network before wallet use', async () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'window');
    let chain = '0x14a34';
    const provider = {
      request: async ({ method }: { method: string }) =>
        method === 'eth_requestAccounts' ? [SAMPLE_PAYER] : chain,
    } as unknown as EIP1193Provider;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { ethereum: provider },
    });
    try {
      assert.equal(await connectPaymentWallet(84532, SAMPLE_PAYER), SAMPLE_PAYER);
      await assert.rejects(connectPaymentWallet(8453), /Switch your wallet/);
      await assert.rejects(
        connectPaymentWallet(84532, '0x2222222222222222222222222222222222222222'),
        /same wallet/,
      );
      await assert.rejects(connectPaymentWallet(1), /not supported/);
      chain = '0x2105';
      assert.equal(await connectPaymentWallet(8453), SAMPLE_PAYER);
    } finally {
      if (saved) Object.defineProperty(globalThis, 'window', saved);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });
});

interface WalletCall {
  method: string;
  params?: readonly unknown[];
}

const transferInput = {
  chainId: 84532,
  tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  payerAddress: SAMPLE_PAYER,
  recipientAddress: '0x2222222222222222222222222222222222222222',
  amountAtoms: '123456789012345678901234',
};
const transactionHash = `0x${'ab'.repeat(32)}`;

function fakePaymentWallet() {
  const calls: WalletCall[] = [];
  const state = {
    account: SAMPLE_PAYER,
    chainId: '0x14a34',
    sendError: undefined as unknown,
    sendResult: transactionHash as unknown,
  };
  const provider = {
    request: async ({ method, params }: WalletCall) => {
      calls.push({ method, params });
      switch (method) {
        case 'eth_requestAccounts':
          return [state.account];
        case 'eth_chainId':
          return state.chainId;
        case 'eth_estimateGas':
          return '0xc350';
        case 'eth_getBlockByNumber':
          return { number: '0x100', baseFeePerGas: '0x3b9aca00', transactions: [] };
        case 'eth_maxPriorityFeePerGas':
          return '0x3b9aca00';
        case 'eth_sendTransaction':
        case 'wallet_sendTransaction':
          if (state.sendError) throw state.sendError;
          return state.sendResult;
        default:
          throw new Error(`Unexpected fake-wallet request: ${method}`);
      }
    },
  } as unknown as EIP1193Provider;
  return { calls, state, provider };
}

async function withPaymentWallet<T>(
  wallet: ReturnType<typeof fakePaymentWallet>,
  run: () => Promise<T>,
): Promise<T> {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { ethereum: wallet.provider },
  });
  try {
    return await run();
  } finally {
    if (saved) Object.defineProperty(globalThis, 'window', saved);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

function sendCalls(wallet: ReturnType<typeof fakePaymentWallet>): WalletCall[] {
  return wallet.calls.filter(
    ({ method }) => method === 'eth_sendTransaction' || method === 'wallet_sendTransaction',
  );
}

describe('USDC transfer review and explicit wallet submission', () => {
  it('returns the gas estimate without requesting any transaction submission', async () => {
    const wallet = fakePaymentWallet();
    await withPaymentWallet(wallet, async () => {
      const prepared = await prepareUsdcTransfer(transferInput);
      assert.equal(prepared.estimatedFeeEth, '0.00011');
      assert.equal(prepared.amountAtoms, transferInput.amountAtoms);
      assert.equal(prepared.recipientAddress, transferInput.recipientAddress);
      assert.equal(typeof prepared.send, 'function');
      assert.equal(wallet.calls.filter(({ method }) => method === 'eth_estimateGas').length, 1);
      assert.equal(sendCalls(wallet).length, 0);
    });
  });

  it('sends the reviewed token, recipient and exact atomic amount only on explicit send', async () => {
    const wallet = fakePaymentWallet();
    await withPaymentWallet(wallet, async () => {
      const prepared = await prepareUsdcTransfer(transferInput);
      assert.equal(sendCalls(wallet).length, 0);
      assert.equal(await prepared.send(), transactionHash);
      const submissions = sendCalls(wallet);
      assert.equal(submissions.length, 1);
      assert.equal(submissions[0]?.method, 'eth_sendTransaction');
      const transaction = submissions[0]?.params?.[0] as Record<string, unknown>;
      const expectedCalldata =
        '0xa9059cbb' +
        transferInput.recipientAddress.slice(2).padStart(64, '0') +
        BigInt(transferInput.amountAtoms).toString(16).padStart(64, '0');
      assert.equal(transaction.data, expectedCalldata);
      assert.equal(String(transaction.to).toLowerCase(), transferInput.tokenAddress.toLowerCase());
      assert.equal(transaction.from, transferInput.payerAddress);
      assert.equal(transaction.chainId, '0x14a34');
      assert.equal(transaction.gas, '0xc350');
      assert.equal(transaction.maxFeePerGas, '0x83215600');
      assert.equal(transaction.maxPriorityFeePerGas, '0x3b9aca00');
      assert.equal(transaction.value, '0x0');
    });
  });

  it('keeps the reviewed transfer fixed if the caller changes its input object', async () => {
    const wallet = fakePaymentWallet();
    await withPaymentWallet(wallet, async () => {
      const input = { ...transferInput };
      const prepared = await prepareUsdcTransfer(input);
      input.chainId = 8453;
      input.tokenAddress = transferInput.recipientAddress;
      input.recipientAddress = SAMPLE_PAYER;
      input.payerAddress = transferInput.recipientAddress;
      input.amountAtoms = '1';
      assert.equal(await prepared.send(), transactionHash);
      const transaction = sendCalls(wallet)[0]?.params?.[0] as Record<string, unknown>;
      assert.equal(transaction.chainId, '0x14a34');
      assert.equal(transaction.from, SAMPLE_PAYER);
      assert.equal(String(transaction.to).toLowerCase(), transferInput.tokenAddress.toLowerCase());
      assert.equal(
        transaction.data,
        '0xa9059cbb' +
          transferInput.recipientAddress.slice(2).padStart(64, '0') +
          BigInt(transferInput.amountAtoms).toString(16).padStart(64, '0'),
      );
    });
  });

  it('blocks submission when the connected payer changes after the review estimate', async () => {
    const wallet = fakePaymentWallet();
    await withPaymentWallet(wallet, async () => {
      const prepared = await prepareUsdcTransfer(transferInput);
      wallet.state.account = transferInput.recipientAddress;
      await assert.rejects(prepared.send(), /same wallet/);
      assert.equal(sendCalls(wallet).length, 0);
      assert.equal(wallet.calls.filter(({ method }) => method === 'eth_requestAccounts').length, 2);
    });
  });

  it('blocks submission when the connected network changes after the review estimate', async () => {
    const wallet = fakePaymentWallet();
    await withPaymentWallet(wallet, async () => {
      const prepared = await prepareUsdcTransfer(transferInput);
      wallet.state.chainId = '0x2105';
      await assert.rejects(prepared.send(), /Switch your wallet/);
      assert.equal(sendCalls(wallet).length, 0);
      assert.equal(wallet.calls.filter(({ method }) => method === 'eth_chainId').length, 2);
    });
  });

  for (const [label, sendError] of [
    ['transport timeout', new Error('Connection timed out after possible broadcast')],
    ['internal RPC error', { code: -32603, message: 'Broadcast result is unknown' }],
    ['generic RPC error', { code: -32000, message: 'Timed out after possible broadcast' }],
  ] as const) {
    it(`does not automatically retry an ambiguous ${label}`, async () => {
      const wallet = fakePaymentWallet();
      await withPaymentWallet(wallet, async () => {
        const prepared = await prepareUsdcTransfer(transferInput);
        wallet.state.sendError = sendError;
        await assert.rejects(prepared.send(), (error: unknown) => {
          assert.equal(walletRequestRejected(error), false);
          return true;
        });
        assert.equal(sendCalls(wallet).length, 1);
      });
    });
  }

  for (const [label, sendResult] of [
    ['short hash', '0x1234'],
    ['non-hex hash', `0x${'zz'.repeat(32)}`],
    ['non-string result', null],
  ] as const) {
    it(`treats a wallet ${label} as uncertain without sending again`, async () => {
      const wallet = fakePaymentWallet();
      await withPaymentWallet(wallet, async () => {
        const prepared = await prepareUsdcTransfer(transferInput);
        wallet.state.sendResult = sendResult;
        await assert.rejects(prepared.send(), (error: unknown) => {
          assert.match(String(error), /may have been sent/);
          assert.equal(walletRequestRejected(error), false);
          return true;
        });
        assert.equal(sendCalls(wallet).length, 1);
      });
    });
  }
});
