import type { Checkout } from '@7even/contracts';
import type { NavigateFunction } from 'react-router-dom';

export function openCheckout(checkout: Checkout, navigate: NavigateFunction) {
  if (checkout.mode === 'mock') {
    navigate(`/checkout/test/${encodeURIComponent(checkout.paymentId)}`);
    return;
  }
  const target = new URL(checkout.checkoutUrl);
  if (target.origin !== 'https://checkout.flutterwave.com' || target.username || target.password) {
    throw new Error('The payment link could not be verified. Open your bookings to continue.');
  }
  window.location.assign(target.href);
}
