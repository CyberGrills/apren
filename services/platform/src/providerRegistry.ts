import type { PaymentProviderId, PaymentExecutionMode } from '@7even/contracts';
import { fail } from './db.ts';
import { FlutterwaveProvider, MockProvider } from './provider.ts';
import type { PaymentProvider } from './provider.ts';
import { PaystackProvider } from './paystackProvider.ts';
import { BaseCryptoGateway, MockCryptoGateway } from './cryptoProvider.ts';
import type { CryptoGateway } from './cryptoProvider.ts';

export const providerIds: Record<PaymentProviderId, number> = {
  flutterwave: 1,
  paystack: 2,
  crypto: 3,
};
export const executionModeIds: Record<PaymentExecutionMode, number> = {
  mock: 1,
  flutterwave: 2,
  paystack: 3,
  crypto: 4,
};
export function providerCode(id: unknown): PaymentProviderId {
  const code = Object.entries(providerIds).find(([, value]) => String(value) === String(id))?.[0];
  if (!code) throw new Error('Unknown persisted payment provider.');
  return code as PaymentProviderId;
}
export function executionModeCode(id: unknown): PaymentExecutionMode {
  const code = Object.entries(executionModeIds).find(
    ([, value]) => String(value) === String(id),
  )?.[0];
  if (!code) throw new Error('Unknown payment execution mode.');
  return code as PaymentExecutionMode;
}
export class ProviderRegistry {
  mode: 'mock' | 'live';
  adapters: Partial<Record<PaymentProviderId, PaymentProvider>>;
  crypto: CryptoGateway;
  constructor(
    options: {
      mode?: 'mock' | 'live';
      adapters?: Partial<Record<PaymentProviderId, PaymentProvider>>;
      crypto?: CryptoGateway;
    } = {},
  ) {
    this.mode =
      options.mode ??
      (process.env.PAYMENT_MODE === 'mock' || !process.env.PAYMENT_MODE ? 'mock' : 'live');
    this.adapters =
      options.adapters ??
      (this.mode === 'mock'
        ? { flutterwave: new MockProvider(), paystack: new MockProvider() }
        : {
            ...(process.env.FLUTTERWAVE_SECRET_KEY
              ? { flutterwave: new FlutterwaveProvider(process.env.FLUTTERWAVE_SECRET_KEY) }
              : {}),
            ...(process.env.PAYSTACK_SECRET_KEY
              ? { paystack: new PaystackProvider(process.env.PAYSTACK_SECRET_KEY) }
              : {}),
          });
    this.crypto =
      options.crypto ??
      (this.mode === 'mock'
        ? new MockCryptoGateway()
        : new BaseCryptoGateway({
            rpcUrl: process.env.CRYPTO_ENABLED === 'true' ? (process.env.BASE_RPC_URL ?? '') : '',
            chainId: Number(process.env.CRYPTO_CHAIN_ID ?? '84532'),
          }));
  }
  get(id: PaymentProviderId): PaymentProvider {
    return (
      this.adapters[id] ??
      fail(
        503,
        'PROVIDER_UNAVAILABLE',
        'This payment provider is not configured. Choose another available payment method.',
      )
    );
  }
  available(id: PaymentProviderId): boolean {
    return id === 'crypto' ? this.crypto.enabled : Boolean(this.adapters[id]);
  }
}
export type ProviderSource = PaymentProvider | ProviderRegistry;
export function providerFor(source: ProviderSource, id: PaymentProviderId): PaymentProvider {
  if (source instanceof ProviderRegistry) return source.get(id);
  if (source.mode !== 'mock' && source.mode !== id)
    return fail(503, 'PROVIDER_UNAVAILABLE', 'The saved payment provider is not configured.');
  return source;
}
const injectedMockCrypto = new MockCryptoGateway();
export function cryptoFor(source: ProviderSource): CryptoGateway {
  if (source instanceof ProviderRegistry) return source.crypto;
  if (source.mode === 'mock') return injectedMockCrypto;
  return fail(503, 'CRYPTO_UNAVAILABLE', 'Crypto checkout is not configured.');
}
export function paymentMode(source: ProviderSource, id: PaymentProviderId): PaymentExecutionMode {
  if (id === 'crypto') return cryptoFor(source).mode;
  return providerFor(source, id).mode;
}
