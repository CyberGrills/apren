import type {
  Checkout,
  Payment,
  PaymentMethod,
  PaymentOptions,
  Reservation,
} from '@7even/contracts';
import { CreditCard, Wallet } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi.ts';
import { api } from '../lib/api.ts';
import { connectPaymentWallet, SAMPLE_PAYER } from '../lib/paymentWallet.ts';
import { openCheckout } from '../pages/customer/checkout.ts';
import { ErrorNotice, Loading, Modal, Money } from './ui.tsx';

export function PaymentMethodDialog({
  reservation,
  onClose,
  returnFocusRef,
}: {
  reservation: Reservation;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const navigate = useNavigate();
  const {
    data: options,
    loading,
    error,
    reload,
  } = useApi<PaymentOptions>(`/reservations/${reservation.id}/payment-options`);
  const {
    data: existing,
    loading: checkingExisting,
    error: existingError,
    reload: reloadExisting,
  } = useApi<Payment>(options?.existingPaymentId ? `/payments/${options.existingPaymentId}` : null);
  const [method, setMethod] = useState<PaymentMethod>('FIAT');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const keys = useRef<Record<string, string>>({});
  async function continuePayment() {
    if (!options) return;
    const selected = existing?.method ?? method;
    setBusy(true);
    setActionError(null);
    try {
      const payerAddress =
        selected === 'USDC_BASE'
          ? (existing?.crypto?.quote.payerAddress ??
            (options.mode === 'mock'
              ? SAMPLE_PAYER
              : await connectPaymentWallet(options.crypto.chainId)))
          : undefined;
      const identity = `${selected}:${payerAddress ?? 'fiat'}`;
      keys.current[identity] ??= crypto.randomUUID();
      const checkout = options.existingPaymentId
        ? await api<Checkout>(`/payments/${options.existingPaymentId}/checkout`)
        : await api<Checkout>(`/reservations/${reservation.id}/checkout`, {
            method: 'POST',
            body: { method: selected, ...(payerAddress ? { payerAddress } : {}) },
            idempotencyKey: keys.current[identity],
          });
      openCheckout(checkout, navigate);
      onClose();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'Payment could not open. Check this booking before trying again.',
      );
      reload();
    } finally {
      setBusy(false);
    }
  }
  const selectedAvailable = method === 'FIAT' ? options?.fiat.available : options?.crypto.available;
  return (
    <Modal
      title="How would you like to pay?"
      onClose={onClose}
      busy={busy}
      returnFocusRef={returnFocusRef}
    >
      <div className="payment-choice-summary">
        <span>{reservation.title}</span>
        <strong>
          <Money minor={reservation.price.totalMinor} />
        </strong>
      </div>
      <p className="small-copy">Your reservation confirms after the server verifies payment.</p>
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {existingError && <ErrorNotice message={existingError} retry={reloadExisting} />}
      {options && (
        <>
          {options.mode === 'mock' && (
            <p className="notice">Local test checkout. No real money or tokens move.</p>
          )}
          {options.existingPaymentId ? (
            <div className="notice">
              {checkingExisting || !existing
                ? 'Checking the payment already started for this booking…'
                : `This booking already has ${existing.method === 'USDC_BASE' ? 'a USDC payment' : `a ${existing.provider === 'paystack' ? 'Paystack' : 'Flutterwave'} payment`}. Continue that payment to avoid paying twice.`}
            </div>
          ) : (
            <fieldset className="payment-methods" disabled={busy}>
              <legend>Payment method</legend>
              <label className={`payment-method ${method === 'FIAT' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="payment-method"
                  value="FIAT"
                  checked={method === 'FIAT'}
                  disabled={!options.fiat.available}
                  onChange={() => setMethod('FIAT')}
                />
                <CreditCard size={22} aria-hidden="true" />
                <span>
                  <strong>Card or bank payment</strong>
                  <span>
                    {options.fiat.provider === 'paystack'
                      ? 'Paystack · ₦50,000 and below'
                      : 'Flutterwave · above ₦50,000'}
                  </span>
                  <small>
                    {options.fiat.reason ??
                      'Pay the full price shown. No added 7even checkout fee.'}
                  </small>
                </span>
              </label>
              <label className={`payment-method ${method === 'USDC_BASE' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="payment-method"
                  value="USDC_BASE"
                  checked={method === 'USDC_BASE'}
                  disabled={!options.crypto.available}
                  onChange={() => setMethod('USDC_BASE')}
                />
                <Wallet size={22} aria-hidden="true" />
                <span>
                  <strong>USDC on Base</strong>
                  <span>
                    {options.crypto.chainId === 84532 ? 'Base Sepolia testnet' : 'Base network'} ·
                    direct to the business wallet
                  </span>
                  <small>
                    {options.crypto.reason ??
                      'The next page locks the token amount. Your wallet shows the ETH network fee before you send.'}
                  </small>
                </span>
              </label>
            </fieldset>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Go back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                busy ||
                (options.existingPaymentId ? !existing || checkingExisting : !selectedAvailable)
              }
              onClick={() => void continuePayment()}
            >
              {busy
                ? 'Opening payment…'
                : options.existingPaymentId
                  ? 'Continue existing payment'
                  : method === 'USDC_BASE' && options.mode !== 'mock'
                    ? 'Connect wallet and continue'
                    : 'Continue to payment'}
            </button>
          </div>
        </>
      )}
      {actionError && <ErrorNotice message={actionError} />}
    </Modal>
  );
}
