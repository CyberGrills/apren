import { createHash } from 'node:crypto';
import {
  createPublicClient,
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  parseAbi,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  verifyMessage,
  type Address,
  type Hex,
  type Transaction,
  type TransactionReceipt,
} from 'viem';

/** Circle-issued native USDC only. Bridged USDbC and arbitrary token contracts are excluded. */
export const USDC_ADDRESSES = Object.freeze({
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
});
const RATE_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=USDC';
const RATE_SOURCE = 'Coinbase exchange-rates USDC/NGN (indicative, not an executable conversion)';
const QUOTE_TTL_MS = 5 * 60_000;
const RATE_MAX_AGE_MS = 60_000;
const transferAbi = parseAbi(['function transfer(address to, uint256 value) returns (bool)']);
const transferEventAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

export interface CryptoQuoteData {
  reference: string;
  chainId: number;
  tokenAddress: string;
  decimals: 6;
  amountAtoms: string;
  payerAddress: string;
  recipientAddress: string;
  rateNgnPerUsdc: string;
  rateSource: string;
  rateFetchedAt: string;
  createdAt: string;
  expiresAt: string;
  anchorBlock: string;
  message: string;
}
export type CryptoTransferIntent = Pick<
  CryptoQuoteData,
  | 'reference'
  | 'chainId'
  | 'tokenAddress'
  | 'decimals'
  | 'amountAtoms'
  | 'payerAddress'
  | 'recipientAddress'
  | 'createdAt'
  | 'expiresAt'
  | 'anchorBlock'
>;
export interface CryptoTransferEvidence {
  status: 'pending' | 'successful' | 'review';
  transactionId: string;
  amountAtoms: string;
  from: string;
  to: string;
  blockNumber: string;
  blockHash: string;
  includedAt: string;
  exception?: string;
  chainId: number;
  tokenAddress: string;
}
export interface CryptoPrepareInput {
  reference: string;
  amountMinor: string;
  payerAddress: string;
  recipientAddress: string;
  expiresAt: string;
}
export interface CryptoGateway {
  enabled: boolean;
  mode: 'mock' | 'crypto';
  prepare(input: CryptoPrepareInput): Promise<CryptoQuoteData>;
  verify(quote: CryptoQuoteData, hash: string): Promise<CryptoTransferEvidence>;
  verifyReturn(intent: CryptoTransferIntent, hash: string): Promise<CryptoTransferEvidence>;
  verifySignature(quote: CryptoQuoteData, signature: string): Promise<boolean>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The crypto provider returned an invalid object.');
  return value as Record<string, unknown>;
}
function wallet(value: string): Address {
  if (!isAddress(value) || value.toLowerCase() === ZERO_ADDRESS)
    throw new Error('A valid nonzero wallet address is required.');
  return getAddress(value);
}
function reference(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(value))
    throw new Error('Invalid crypto payment reference.');
  return value;
}
function tokenForChain(chainId: number): Address {
  if (chainId !== 8453 && chainId !== 84532)
    throw new Error('Crypto payments support Base or Base Sepolia only.');
  return USDC_ADDRESSES[chainId];
}
function isoTime(value: string): number {
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
    throw new Error('A valid ISO expiry or creation time is required.');
  return time;
}
function exactRate(rate: string): { numerator: bigint; scale: bigint } {
  if (!/^(0|[1-9]\d{0,11})(\.\d{1,30})?$/.test(rate))
    throw new Error('A positive exact decimal USDC/NGN rate is required.');
  const [whole = '0', fraction = ''] = rate.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole) * scale + BigInt(fraction || '0');
  if (numerator === 0n) throw new Error('The USDC/NGN rate must be positive.');
  return { numerator, scale };
}
/** Round the NGN bill upward to a single USDC atomic unit, without binary floating point. */
export function quoteAmountAtoms(amountMinor: string, rateNgnPerUsdc: string): string {
  if (!/^[1-9]\d{0,17}$/.test(amountMinor))
    throw new Error('The NGN minor-unit amount must be a positive bounded integer string.');
  const rate = exactRate(rateNgnPerUsdc);
  const numerator = BigInt(amountMinor) * 1_000_000n * rate.scale;
  const denominator = rate.numerator * 100n;
  return ((numerator + denominator - 1n) / denominator).toString();
}

/** A proof of wallet control, never a token approval, spending permit or transaction signature. */
export function buildCryptoPaymentMessage(quote: Omit<CryptoQuoteData, 'message'>): string {
  return [
    '7even crypto payment wallet proof',
    'This signature proves wallet control. It does not approve or send funds.',
    `Reference and nonce: ${reference(quote.reference)}`,
    `Network: Base (${quote.chainId})`,
    `Token: ${wallet(quote.tokenAddress)}`,
    `Payer: ${wallet(quote.payerAddress)}`,
    `Business recipient: ${wallet(quote.recipientAddress)}`,
    `USDC atomic units (6 decimals): ${quote.amountAtoms}`,
    `Indicative NGN per USDC: ${quote.rateNgnPerUsdc}`,
    `Rate retrieved: ${quote.rateFetchedAt}`,
    `Created: ${quote.createdAt}`,
    `Expires: ${quote.expiresAt}`,
    `After block: ${quote.anchorBlock}`,
  ].join('\n');
}

export function buildBusinessWalletMessage(input: {
  reference: string;
  venueId: string;
  chainId: number;
  walletAddress: string;
  expiresAt: string;
}): string {
  tokenForChain(input.chainId);
  isoTime(input.expiresAt);
  return [
    '7even business settlement wallet proof',
    'This signature links a receiving wallet. It does not approve or send funds.',
    `Venue: ${reference(input.venueId)}`,
    `Reference and nonce: ${reference(input.reference)}`,
    `Network: Base (${input.chainId})`,
    `Receiving wallet: ${wallet(input.walletAddress)}`,
    `Expires: ${input.expiresAt}`,
  ].join('\n');
}

/** Local ECDSA recovery deliberately supports EOA wallets only, with no ERC-1271 RPC fallback. */
export async function verifyEoaSignature(input: {
  address: string;
  message: string;
  signature: string;
}): Promise<boolean> {
  try {
    if (!/^0x[0-9a-fA-F]{130}$/.test(input.signature)) return false;
    return await verifyMessage({
      address: wallet(input.address),
      message: input.message,
      signature: input.signature as Hex,
    });
  } catch {
    return false;
  }
}

function validateTransferIntent(
  quote: CryptoTransferIntent,
  chainId: number,
  maxDuration: number,
): void {
  const token = tokenForChain(chainId);
  if (quote.chainId !== chainId || quote.tokenAddress.toLowerCase() !== token.toLowerCase())
    throw new Error('The quote token or network does not match the configured Base chain.');
  if (
    quote.decimals !== 6 ||
    !/^[1-9]\d{0,77}$/.test(quote.amountAtoms) ||
    BigInt(quote.amountAtoms) >= 2n ** 256n
  )
    throw new Error('The quote has invalid USDC atomic units.');
  if (!/^(0|[1-9]\d{0,30})$/.test(quote.anchorBlock))
    throw new Error('The quote has an invalid anchor block.');
  const createdAt = isoTime(quote.createdAt);
  const expiresAt = isoTime(quote.expiresAt);
  reference(quote.reference);
  if (expiresAt <= createdAt || expiresAt - createdAt > maxDuration)
    throw new Error('The transfer intent has invalid expiry times.');
  if (wallet(quote.payerAddress) === wallet(quote.recipientAddress))
    throw new Error('The payer and business wallet addresses must be different.');
}
function validateReturnIntent(intent: CryptoTransferIntent, chainId: number): void {
  validateTransferIntent(intent, chainId, 30 * 86_400_000);
}
function returnBinding(intent: CryptoTransferIntent): string {
  return JSON.stringify([
    '7even merchant USDC return',
    intent.reference,
    intent.chainId,
    intent.tokenAddress.toLowerCase(),
    intent.decimals,
    intent.amountAtoms,
    intent.payerAddress.toLowerCase(),
    intent.recipientAddress.toLowerCase(),
    intent.createdAt,
    intent.expiresAt,
    intent.anchorBlock,
  ]);
}
function validateQuote(quote: CryptoQuoteData, chainId: number): void {
  validateTransferIntent(quote, chainId, QUOTE_TTL_MS);
  const createdAt = isoTime(quote.createdAt);
  const rateFetchedAt = isoTime(quote.rateFetchedAt);
  if (rateFetchedAt > createdAt || createdAt - rateFetchedAt > RATE_MAX_AGE_MS)
    throw new Error('The quote has invalid expiry or rate retrieval times.');
  exactRate(quote.rateNgnPerUsdc);
  if (quote.message !== buildCryptoPaymentMessage(quote))
    throw new Error('The crypto quote does not match its wallet proof message.');
}
async function verifyQuoteSignature(
  quote: CryptoQuoteData,
  signature: string,
  chainId: number,
): Promise<boolean> {
  try {
    validateQuote(quote, chainId);
    return await verifyEoaSignature({
      address: quote.payerAddress,
      message: quote.message,
      signature,
    });
  } catch {
    return false;
  }
}
function makeQuote(
  input: CryptoPrepareInput,
  details: {
    chainId: number;
    rate: string;
    rateSource: string;
    rateFetchedAt: Date;
    now: Date;
    anchorBlock: bigint;
  },
): CryptoQuoteData {
  const expiresAt = Math.min(isoTime(input.expiresAt), details.now.getTime() + QUOTE_TTL_MS);
  if (expiresAt <= details.now.getTime()) throw new Error('The crypto quotation has expired.');
  const quote = {
    reference: reference(input.reference),
    chainId: details.chainId,
    tokenAddress: tokenForChain(details.chainId),
    decimals: 6 as const,
    amountAtoms: quoteAmountAtoms(input.amountMinor, details.rate),
    payerAddress: wallet(input.payerAddress),
    recipientAddress: wallet(input.recipientAddress),
    rateNgnPerUsdc: details.rate,
    rateSource: details.rateSource,
    rateFetchedAt: details.rateFetchedAt.toISOString(),
    createdAt: details.now.toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    anchorBlock: details.anchorBlock.toString(),
  };
  const result = { ...quote, message: buildCryptoPaymentMessage(quote) };
  validateQuote(result, details.chainId);
  return result;
}
function pendingEvidence(quote: CryptoTransferIntent, hash: string): CryptoTransferEvidence {
  return {
    status: 'pending',
    transactionId: hash,
    amountAtoms: '0',
    from: '',
    to: '',
    blockNumber: '',
    blockHash: '',
    includedAt: '',
    chainId: quote.chainId,
    tokenAddress: quote.tokenAddress,
  };
}
function validHash(value: string): asserts value is Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('Invalid blockchain transaction hash.');
}
function rpcClient(url: string, transport: typeof fetch) {
  return createPublicClient({
    cacheTime: 0,
    transport: http(url, {
      fetchFn: transport,
      timeout: 8_000,
      retryCount: 0,
      batch: false,
      maxResponseBodySize: 1_048_576,
    }),
  });
}
async function readRpc<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof TransactionReceiptNotFoundError ||
      error instanceof TransactionNotFoundError
    )
      throw error;
    // RPC URLs may contain private API keys. Never expose viem's nested URL/request diagnostics.
    throw new Error(
      'The Base node is unavailable. Reconcile the transaction before retrying payment.',
    );
  }
}

/** Read-only chain verification. This class never holds keys, signs transactions or moves funds. */
export class BaseCryptoGateway implements CryptoGateway {
  readonly mode = 'crypto' as const;
  readonly enabled: boolean;
  readonly chainId: number;
  private readonly client: ReturnType<typeof rpcClient> | undefined;
  private readonly rateTransport: typeof fetch;
  private readonly clock: () => Date;
  constructor(input: {
    rpcUrl: string;
    chainId: number;
    transport?: typeof fetch;
    rateTransport?: typeof fetch;
    clock?: () => Date;
  }) {
    tokenForChain(input.chainId);
    this.chainId = input.chainId;
    this.enabled = input.rpcUrl.length > 0;
    if (this.enabled) {
      const url = new URL(input.rpcUrl);
      const localHttp =
        process.env.NODE_ENV !== 'production' &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.protocol !== 'https:' && !localHttp)
        throw new Error(
          'Crypto RPC requires HTTPS. Local development nodes may use loopback HTTP.',
        );
      this.client = rpcClient(input.rpcUrl, input.transport ?? fetch);
    }
    this.rateTransport = input.rateTransport ?? fetch;
    this.clock = input.clock ?? (() => new Date());
  }
  private rpc() {
    if (!this.client)
      throw new Error('Crypto payments are unavailable until the Base RPC is configured.');
    return this.client;
  }
  private async assertChain(): Promise<void> {
    if ((await readRpc(() => this.rpc().getChainId())) !== this.chainId)
      throw new Error('The RPC network does not match the configured Base chain.');
  }
  private async rate(): Promise<{ value: string; fetchedAt: Date }> {
    const startedAt = this.clock().getTime();
    const response = await this.rateTransport(RATE_URL, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
      signal: AbortSignal.timeout(8_000),
    });
    const fetchedAt = this.clock();
    const sourceTime = Date.parse(response.headers.get('date') ?? '');
    const age = response.headers.get('age') ?? '0';
    if (
      !response.ok ||
      fetchedAt.getTime() - startedAt > 15_000 ||
      !Number.isFinite(sourceTime) ||
      sourceTime > fetchedAt.getTime() + 30_000 ||
      fetchedAt.getTime() - sourceTime > RATE_MAX_AGE_MS ||
      !/^\d{1,6}$/.test(age) ||
      Number(age) > 30
    )
      throw new Error('A fresh indicative USDC/NGN rate could not be retrieved.');
    const text = await response.text();
    if (text.length > 100_000) throw new Error('The indicative rate response is too large.');
    const data = record(record(JSON.parse(text)).data);
    const value = record(data.rates).NGN;
    if (data.currency !== 'USDC' || typeof value !== 'string')
      throw new Error('The indicative USDC/NGN rate response is invalid.');
    exactRate(value);
    return { value, fetchedAt };
  }
  async prepare(input: CryptoPrepareInput): Promise<CryptoQuoteData> {
    this.rpc();
    reference(input.reference);
    wallet(input.payerAddress);
    wallet(input.recipientAddress);
    quoteAmountAtoms(input.amountMinor, '1');
    if (isoTime(input.expiresAt) <= this.clock().getTime())
      throw new Error('The crypto quotation has expired.');
    await this.assertChain();
    const [rate, anchor] = await Promise.all([
      this.rate(),
      readRpc(() => this.rpc().getBlock({ blockTag: 'latest' })),
    ]);
    if (anchor.number === null) throw new Error('Could not establish a current Base anchor block.');
    return makeQuote(input, {
      chainId: this.chainId,
      rate: rate.value,
      rateSource: RATE_SOURCE,
      rateFetchedAt: rate.fetchedAt,
      now: this.clock(),
      anchorBlock: anchor.number,
    });
  }
  verifySignature(quote: CryptoQuoteData, signature: string): Promise<boolean> {
    return verifyQuoteSignature(quote, signature, this.chainId);
  }
  async verify(quote: CryptoQuoteData, hash: string): Promise<CryptoTransferEvidence> {
    validateQuote(quote, this.chainId);
    return this.verifyTransfer(quote, hash);
  }
  async verifyReturn(intent: CryptoTransferIntent, hash: string): Promise<CryptoTransferEvidence> {
    validateReturnIntent(intent, this.chainId);
    return this.verifyTransfer(intent, hash);
  }
  private async verifyTransfer(
    quote: CryptoTransferIntent,
    hash: string,
  ): Promise<CryptoTransferEvidence> {
    this.rpc();
    validHash(hash);
    await this.assertChain();
    let receipt: TransactionReceipt;
    let transaction: Transaction;
    try {
      [receipt, transaction] = await Promise.all([
        readRpc(() => this.rpc().getTransactionReceipt({ hash })),
        readRpc(() => this.rpc().getTransaction({ hash })),
      ]);
    } catch (error) {
      if (
        error instanceof TransactionReceiptNotFoundError ||
        error instanceof TransactionNotFoundError
      )
        return pendingEvidence(quote, hash);
      throw new Error(
        'The blockchain transaction could not be checked. Reconcile before retrying payment.',
      );
    }
    const result = pendingEvidence(quote, hash);
    result.from = transaction.from;
    result.blockNumber = receipt.blockNumber.toString();
    result.blockHash = receipt.blockHash;
    const [canonical, finalized] = await Promise.all([
      readRpc(() => this.rpc().getBlock({ blockNumber: receipt.blockNumber })),
      readRpc(() => this.rpc().getBlock({ blockTag: 'finalized' })),
    ]);
    if (
      canonical.hash !== receipt.blockHash ||
      transaction.blockHash !== receipt.blockHash ||
      transaction.blockNumber !== receipt.blockNumber ||
      finalized.number === null ||
      finalized.number < receipt.blockNumber
    )
      return result;
    result.includedAt = new Date(Number(canonical.timestamp) * 1000).toISOString();
    const review = (reason: string): CryptoTransferEvidence => ({
      ...result,
      status: 'review',
      exception: reason,
    });
    if (receipt.status !== 'success') return review('The blockchain transaction reverted.');
    if (
      receipt.transactionHash.toLowerCase() !== hash.toLowerCase() ||
      transaction.hash.toLowerCase() !== hash.toLowerCase()
    )
      return review('The RPC transaction identity did not match the submitted hash.');
    if (
      transaction.to?.toLowerCase() !== quote.tokenAddress.toLowerCase() ||
      receipt.to?.toLowerCase() !== quote.tokenAddress.toLowerCase() ||
      transaction.from.toLowerCase() !== quote.payerAddress.toLowerCase() ||
      receipt.from.toLowerCase() !== quote.payerAddress.toLowerCase() ||
      transaction.value !== 0n
    )
      return review(
        'The transfer must come directly from the proven payer to the native USDC contract.',
      );
    try {
      const call = decodeFunctionData({ abi: transferAbi, data: transaction.input });
      const [recipient, atoms] = call.args;
      result.to = recipient;
      result.amountAtoms = atoms.toString();
      if (
        recipient.toLowerCase() !== quote.recipientAddress.toLowerCase() ||
        atoms.toString() !== quote.amountAtoms ||
        transaction.input.toLowerCase() !==
          encodeFunctionData({
            abi: transferAbi,
            functionName: 'transfer',
            args: [recipient, atoms],
          }).toLowerCase()
      )
        return review('The direct USDC transfer recipient or amount does not match the quote.');
      const logs = receipt.logs.filter(
        (log) =>
          log.address.toLowerCase() === quote.tokenAddress.toLowerCase() &&
          log.topics[0]?.toLowerCase() === TRANSFER_TOPIC,
      );
      if (logs.length !== 1) return review('Exactly one native USDC Transfer event is required.');
      const log = logs[0];
      if (
        !log ||
        log.removed ||
        log.transactionHash?.toLowerCase() !== hash.toLowerCase() ||
        log.blockHash !== receipt.blockHash
      )
        return review('The USDC transfer event identity is invalid.');
      const event = decodeEventLog({
        abi: transferEventAbi,
        eventName: 'Transfer',
        data: log.data,
        topics: log.topics,
      });
      if (
        event.args.from.toLowerCase() !== quote.payerAddress.toLowerCase() ||
        event.args.to.toLowerCase() !== quote.recipientAddress.toLowerCase() ||
        event.args.value.toString() !== quote.amountAtoms
      )
        return review('The confirmed USDC transfer event does not match the quote.');
    } catch {
      return review('The transaction does not contain a valid exact direct USDC transfer.');
    }
    const includedAt = Number(canonical.timestamp) * 1000;
    if (receipt.blockNumber <= BigInt(quote.anchorBlock) || includedAt < isoTime(quote.createdAt))
      return review('This transfer predates the quotation.');
    if (includedAt >= isoTime(quote.expiresAt))
      return review('The transfer was included after the quote expired.');
    return { ...result, status: 'successful' };
  }
}

/** Explicit local-development double. No real blockchain or provider settlement is represented. */
export class MockCryptoGateway implements CryptoGateway {
  readonly mode = 'mock' as const;
  readonly enabled = true;
  readonly chainId: number;
  private readonly clock: () => Date;
  private readonly receipts = new Map<
    string,
    { message: string; evidence: CryptoTransferEvidence }
  >();
  constructor(input: { clock?: () => Date; chainId?: number } = {}) {
    this.clock = input.clock ?? (() => new Date());
    this.chainId = input.chainId ?? 84532;
    tokenForChain(this.chainId);
  }
  prepare(input: CryptoPrepareInput): Promise<CryptoQuoteData> {
    const now = this.clock();
    return Promise.resolve(
      makeQuote(input, {
        chainId: this.chainId,
        rate: '1500',
        rateSource: 'Local mock rate, no conversion or real funds',
        rateFetchedAt: now,
        now,
        anchorBlock: 0n,
      }),
    );
  }
  verifySignature(quote: CryptoQuoteData, signature: string): Promise<boolean> {
    return verifyQuoteSignature(quote, signature, this.chainId);
  }
  verify(quote: CryptoQuoteData, hash: string): Promise<CryptoTransferEvidence> {
    validHash(hash);
    validateQuote(quote, this.chainId);
    return this.recorded(quote, hash, quote.message);
  }
  verifyReturn(intent: CryptoTransferIntent, hash: string): Promise<CryptoTransferEvidence> {
    validHash(hash);
    validateReturnIntent(intent, this.chainId);
    return this.recorded(intent, hash, returnBinding(intent));
  }
  private recorded(
    quote: CryptoTransferIntent,
    hash: string,
    binding: string,
  ): Promise<CryptoTransferEvidence> {
    const receipt = this.receipts.get(hash.toLowerCase());
    return Promise.resolve(
      receipt?.message === binding ? { ...receipt.evidence } : pendingEvidence(quote, hash),
    );
  }
  complete(quote: CryptoQuoteData, suppliedHash?: string): string {
    validateQuote(quote, this.chainId);
    return this.completeTransfer(quote, quote.message, suppliedHash);
  }
  completeReturn(intent: CryptoTransferIntent, suppliedHash?: string): string {
    validateReturnIntent(intent, this.chainId);
    return this.completeTransfer(intent, returnBinding(intent), suppliedHash);
  }
  private completeTransfer(
    quote: CryptoTransferIntent,
    binding: string,
    suppliedHash?: string,
  ): string {
    const hash = suppliedHash ?? `0x${createHash('sha256').update(quote.reference).digest('hex')}`;
    validHash(hash);
    const previous = this.receipts.get(hash.toLowerCase());
    if (previous && previous.message !== binding)
      throw new Error('This local crypto transaction already belongs to another quote.');
    if (!previous) {
      if (this.clock().getTime() >= isoTime(quote.expiresAt))
        throw new Error('The local crypto quote has expired.');
      this.receipts.set(hash.toLowerCase(), {
        message: binding,
        evidence: {
          status: 'successful',
          transactionId: hash,
          amountAtoms: quote.amountAtoms,
          from: quote.payerAddress,
          to: quote.recipientAddress,
          blockNumber: (BigInt(quote.anchorBlock) + 1n).toString(),
          blockHash: `0x${'0'.repeat(63)}1`,
          includedAt: this.clock().toISOString(),
          chainId: this.chainId,
          tokenAddress: quote.tokenAddress,
        },
      });
    }
    return hash;
  }
}
