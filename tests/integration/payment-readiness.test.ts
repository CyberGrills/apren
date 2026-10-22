import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentReadiness } from '../../services/platform/src/providerRegistry.ts';

test('production payment readiness does not confuse live mode with configured providers', () => {
  const readiness = paymentReadiness('production', { VERCEL_ENV: 'production' } as NodeJS.ProcessEnv);
  assert.equal(readiness.mode, 'live');
  assert.equal(readiness.fiatReady, false);
  assert.deepEqual(readiness.providers, { paystack: false, flutterwave: false, crypto: false });
  assert.deepEqual(readiness.missingRequiredConfiguration, [
    'PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_WEBHOOK_SECRET',
  ]);
});

test('fiat payment readiness requires both providers and Flutterwave webhook verification', () => {
  const readiness = paymentReadiness('production', {
    VERCEL_ENV: 'production', PAYMENT_MODE: 'live',
    PAYSTACK_SECRET_KEY: 'test-paystack-key',
    FLUTTERWAVE_SECRET_KEY: 'test-flutterwave-key',
    FLUTTERWAVE_WEBHOOK_SECRET: 'test-flutterwave-webhook-secret',
  } as NodeJS.ProcessEnv);
  assert.equal(readiness.fiatReady, true);
  assert.deepEqual(readiness.missingRequiredConfiguration, []);
  assert.equal(readiness.providers.paystack, true);
  assert.equal(readiness.providers.flutterwave, true);
  assert.equal(readiness.providers.crypto, false);
});

test('mock execution is never represented as live-fiat-ready', () => {
  const readiness = paymentReadiness('production', {
    VERCEL_ENV: 'production', PAYMENT_MODE: 'mock',
    PAYSTACK_SECRET_KEY: 'test-paystack-key',
    FLUTTERWAVE_SECRET_KEY: 'test-flutterwave-key',
    FLUTTERWAVE_WEBHOOK_SECRET: 'test-flutterwave-webhook-secret',
  } as NodeJS.ProcessEnv);
  assert.equal(readiness.mode, 'mock');
  assert.equal(readiness.fiatReady, false);
  assert.ok(readiness.missingRequiredConfiguration.includes('PAYMENT_MODE=live'));
});
