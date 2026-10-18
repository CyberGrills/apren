import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Checkout } from '@7even/contracts';
import type { NavigateFunction } from 'react-router-dom';
import { openCheckout } from './checkout.ts';

const fixture: Checkout = {
  paymentId: '9e6d393f-7d02-4d89-81d6-d04dcf1288f4',
  reference: 'local-test-reference',
  checkoutUrl: 'https://checkout.flutterwave.com/v3/hosted/pay/test',
  mode: 'flutterwave',
};

describe('checkout destination boundary', () => {
  it('keeps mock checkout local even if a response includes a remote URL', () => {
    const routes: string[] = [];
    const navigate = ((route: string) => {
      routes.push(route);
    }) as NavigateFunction;
    openCheckout(
      { ...fixture, mode: 'mock', checkoutUrl: 'https://untrusted.example/pay' },
      navigate,
    );
    assert.deepEqual(routes, [`/checkout/test/${fixture.paymentId}`]);
  });

  it('refuses untrusted, unencrypted, credential-bearing and alternate-port destinations', () => {
    const navigate = (() => {
      throw new Error('Must not navigate.');
    }) as NavigateFunction;
    for (const checkoutUrl of [
      'http://checkout.flutterwave.com/pay',
      'https://checkout.flutterwave.com.untrusted.example/pay',
      'https://untrusted.example/checkout.flutterwave.com',
      'https://user:password@checkout.flutterwave.com/pay',
      'https://checkout.flutterwave.com:8443/pay',
      'javascript:alert(1)',
      'not a url',
    ])
      assert.throws(() => openCheckout({ ...fixture, checkoutUrl }, navigate));
  });

  it('opens only the approved HTTPS Flutterwave origin for live checkout', () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const destinations: string[] = [];
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          assign: (url: string) => {
            destinations.push(url);
          },
        },
      },
    });
    try {
      openCheckout(fixture, (() => {
        throw new Error('Live checkout must leave through the approved origin.');
      }) as NavigateFunction);
      assert.deepEqual(destinations, [fixture.checkoutUrl]);
    } finally {
      if (saved) Object.defineProperty(globalThis, 'window', saved);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('keeps crypto checkout local for both mock and live execution', () => {
    const routes: string[] = [];
    for (const mode of ['mock', 'crypto'] as const)
      openCheckout(
        {
          ...fixture,
          mode,
          provider: 'crypto',
          method: 'USDC_BASE',
          checkoutUrl: 'https://untrusted.example/pay',
        },
        ((route: string) => {
          routes.push(route);
        }) as NavigateFunction,
      );
    assert.deepEqual(routes, Array(2).fill(`/checkout/crypto/${fixture.paymentId}`));
  });

  it('refuses cross-provider destinations and inconsistent recorded modes', () => {
    const navigate = (() => {
      throw new Error('Must not navigate.');
    }) as NavigateFunction;
    for (const checkoutUrl of [
      'https://checkout.flutterwave.com/pay',
      'http://checkout.paystack.com/pay',
      'https://checkout.paystack.com.evil.example/pay',
      'https://user:password@checkout.paystack.com/pay',
      'https://checkout.paystack.com:8443/pay',
    ])
      assert.throws(() =>
        openCheckout({ ...fixture, mode: 'paystack', provider: 'paystack', checkoutUrl }, navigate),
      );
    assert.throws(() =>
      openCheckout({ ...fixture, mode: 'paystack', provider: 'flutterwave' }, navigate),
    );
    assert.throws(() =>
      openCheckout(
        { ...fixture, mode: 'paystack', provider: 'paystack', method: 'USDC_BASE' },
        navigate,
      ),
    );
  });

  it('opens Paystack only on its own approved HTTPS checkout origin', () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const destinations: string[] = [];
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          assign: (url: string) => {
            destinations.push(url);
          },
        },
      },
    });
    try {
      openCheckout(
        {
          ...fixture,
          mode: 'paystack',
          provider: 'paystack',
          checkoutUrl: 'https://checkout.paystack.com/test',
        },
        (() => {
          throw new Error('Live payment must use the approved origin.');
        }) as NavigateFunction,
      );
      assert.deepEqual(destinations, ['https://checkout.paystack.com/test']);
    } finally {
      if (saved) Object.defineProperty(globalThis, 'window', saved);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });
});
