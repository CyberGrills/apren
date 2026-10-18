import type { Checkout } from '@7even/contracts';
import type { NavigateFunction } from 'react-router-dom';

export function openCheckout(checkout: Checkout, navigate: NavigateFunction) {
  if (
    (checkout.provider && checkout.mode !== 'mock' && checkout.mode !== checkout.provider) ||
    (checkout.method === 'USDC_BASE' && checkout.provider && checkout.provider !== 'crypto')
  )
    throw new Error('The payment method could not be verified. Open your bookings to continue.');
  if (checkout.provider === 'crypto' || checkout.method === 'USDC_BASE') {
    navigate(`/checkout/crypto/${encodeURIComponent(checkout.paymentId)}`);
    return;
  }
  if (checkout.mode === 'mock') {
    navigate(`/checkout/test/${encodeURIComponent(checkout.paymentId)}`);
    return;
  }
  const target = new URL(checkout.checkoutUrl);
  const provider = checkout.provider ?? (checkout.mode === 'flutterwave' ? 'flutterwave' : null);
  const origin =
    provider === 'paystack'
      ? 'https://checkout.paystack.com'
      : provider === 'flutterwave'
        ? 'https://checkout.flutterwave.com'
        : null;
  if (!origin || target.origin !== origin || target.username || target.password) {
    throw new Error('The payment link could not be verified. Open your bookings to continue.');
  }
  window.location.assign(target.href);
}
