import type { Address, EIP1193Provider, Hex } from 'viem';

export const SAMPLE_PAYER = '0x1111111111111111111111111111111111111111';
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

export function formatUsdc(atoms: string): string {
  if (!/^(0|[1-9]\d{0,77})$/.test(atoms)) throw new Error('The token amount is unreadable.');
  const value = BigInt(atoms);
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, '0')}`;
}

/** Only the wallet's structured rejection code proves no approval was granted. */
export function walletRequestRejected(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth++) {
    const failure = current as { code?: unknown; cause?: unknown };
    if (failure.code === 4001) return true;
    current = failure.cause;
  }
  return false;
}

export function walletProvider(): EIP1193Provider {
  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!provider?.request)
    throw new Error('Open this page in a browser with a compatible wallet, then try again.');
  return provider;
}

export async function connectPaymentWallet(
  chainId: number,
  expectedAddress?: string,
): Promise<Address> {
  if (chainId !== 8453 && chainId !== 84532)
    throw new Error('This payment network is not supported.');
  const provider = walletProvider();
  const addresses = await provider.request({ method: 'eth_requestAccounts' });
  const address = addresses[0];
  if (!address || !addressPattern.test(address))
    throw new Error('Choose an account in your wallet.');
  const currentChain = await provider.request({ method: 'eth_chainId' });
  if (BigInt(currentChain) !== BigInt(chainId))
    throw new Error(
      `Switch your wallet to ${chainId === 84532 ? 'Base Sepolia testnet' : 'Base'}, then try again.`,
    );
  if (expectedAddress && address.toLowerCase() !== expectedAddress.toLowerCase())
    throw new Error('Connect the same wallet recorded for this payment.');
  return address;
}

export async function signWalletMessage(
  message: string,
  chainId: number,
  expectedAddress: string,
): Promise<Hex> {
  const account = await connectPaymentWallet(chainId, expectedAddress);
  const { createWalletClient, custom } = await import('viem');
  const client = createWalletClient({ transport: custom(walletProvider(), { retryCount: 0 }) });
  return client.signMessage({ account, message });
}

export interface PreparedTokenTransfer {
  amountAtoms: string;
  recipientAddress: string;
  estimatedFeeEth: string;
  send: () => Promise<Hex>;
}

/** Estimate first. The caller must obtain an explicit review action before calling send. */
export async function prepareUsdcTransfer(input: {
  chainId: number;
  tokenAddress: string;
  payerAddress: string;
  recipientAddress: string;
  amountAtoms: string;
}): Promise<PreparedTokenTransfer> {
  if (!addressPattern.test(input.tokenAddress) || !addressPattern.test(input.recipientAddress))
    throw new Error('The recorded token or destination could not be verified.');
  formatUsdc(input.amountAtoms);
  if (BigInt(input.amountAtoms) <= 0n)
    throw new Error('The transfer amount must be greater than zero.');
  const account = await connectPaymentWallet(input.chainId, input.payerAddress);
  const [
    { createPublicClient, custom, encodeFunctionData, formatEther, toHex },
    { base, baseSepolia },
  ] = await Promise.all([import('viem'), import('viem/chains')]);
  const chain = input.chainId === 8453 ? base : baseSepolia;
  const transport = custom(walletProvider(), { retryCount: 0 });
  const publicClient = createPublicClient({ chain, transport });
  const to = input.tokenAddress as Address;
  const data = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
      },
    ],
    functionName: 'transfer',
    args: [input.recipientAddress as Address, BigInt(input.amountAtoms)],
  });
  const [gas, fees] = await Promise.all([
    publicClient.estimateGas({ account, to, data }),
    publicClient.estimateFeesPerGas(),
  ]);
  return {
    amountAtoms: input.amountAtoms,
    recipientAddress: input.recipientAddress,
    estimatedFeeEth: formatEther(gas * fees.maxFeePerGas),
    send: async () => {
      await connectPaymentWallet(chain.id, account);
      // A possible broadcast must never trigger a second wallet method or automatic retry.
      const hash = await walletProvider().request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to,
            data,
            value: '0x0',
            chainId: toHex(chain.id),
            gas: toHex(gas),
            maxFeePerGas: toHex(fees.maxFeePerGas),
            maxPriorityFeePerGas: toHex(fees.maxPriorityFeePerGas),
          },
        ],
      });
      if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash))
        throw new Error(
          'Your wallet did not return a valid transaction reference. The transfer may have been sent. Do not retry it; check your wallet activity.',
        );
      return hash;
    },
  };
}
