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
});
