import type {
  Checkout,
  Payment,
  PaymentMethod,
  PaymentOptions,
  Reservation,
} from '@7even/contracts';
import { Building2, CreditCard, Wallet } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi.ts';
import { api } from '../lib/api.ts';
import { connectPaymentWallet, SAMPLE_PAYER } from '../lib/paymentWallet.ts';
import { openCheckout } from '../pages/customer/checkout.ts';
import { ErrorNotice, Loading, Modal, Money } from './ui.tsx';
import { useSevenLanguage } from '../lib/sevenLanguage.ts';

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
  const language = useSevenLanguage();
  const pcm = language === 'pcm';
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
          : (pcm ? 'Payment no fit open. Check this booking before you try again.' : 'Payment could not open. Check this booking before trying again.'),
      );
      reload();
    } finally {
      setBusy(false);
    }
  }
  const selectedAvailable = method === 'FIAT' ? options?.fiat.available : options?.crypto.available;
  return (
    <Modal
      title={pcm ? 'How you wan pay?' : 'How would you like to pay?'}
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
      <p className="small-copy">{pcm ? 'We go confirm your reservation only after server don verify payment.' : 'Your reservation confirms after the server verifies payment.'}</p>
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {existingError && <ErrorNotice message={existingError} retry={reloadExisting} />}
      {options && (
        <>
          {options.mode === 'mock' && (
            <p className="notice">{pcm ? 'Na local test checkout be this. No real money or token go move.' : 'Local test checkout. No real money or tokens move.'}</p>
          )}
          {options.existingPaymentId ? (
            <div className="notice">
              {checkingExisting || !existing
                ? (pcm ? 'We dey check payment wey don start for this booking…' : 'Checking the payment already started for this booking…')
                : `This booking already has ${existing.method === 'USDC_BASE' ? 'a USDC payment' : `a ${existing.provider === 'paystack' ? 'Paystack' : 'Flutterwave'} payment`}. Continue that payment to avoid paying twice.`}
            </div>
          ) : (
            <fieldset className="payment-methods" disabled={busy}>
              <legend>{pcm ? 'Choose how you wan pay' : 'Choose how to pay'}</legend>
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
                  <strong>{pcm ? 'Card or bank transfer' : 'Card or bank payment'}</strong>
                  <span>
                    {options.fiat.provider === 'paystack'
                      ? 'Paystack · ₦50,000 and below'
                      : 'Flutterwave · above ₦50,000'}
                  </span>
                  <small>
                    {options.fiat.reason ??
                      (pcm ? 'Pay the full price wey you see. 7even no add checkout fee.' : 'Pay the full price shown. No added 7even checkout fee.')}
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
                      (pcm ? 'The next page go lock the token amount. Your wallet go show ETH network fee before you send.' : 'The next page locks the token amount. Your wallet shows the ETH network fee before you send.')}
                  </small>
                </span>
              </label>
              <div className="payment-method payment-method-unavailable" aria-disabled="true">
                <Building2 size={22} aria-hidden="true" />
                <span>
                  <strong>{pcm ? 'Pay for the hotel' : 'Pay at the property'}</strong>
                  <span>{pcm ? 'Pay the hotel directly when you reach there' : 'Pay the hotel directly when you arrive'}</span>
                  <small>
                    {pcm ? 'This option never dey available for this property yet. We go only enable am when the hotel approve pay-at-property booking and confirm the reservation terms.' : 'Not available for this property yet. We will only enable this option when the hotel has approved pay-at-property bookings and confirmed its reservation terms.'}
                  </small>
                </span>
              </div>
            </fieldset>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              {pcm ? 'Go back' : 'Go back'}
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
                ? (pcm ? 'We dey open payment…' : 'Opening payment…')
                : options.existingPaymentId
                  ? (pcm ? 'Continue the payment wey don start' : 'Continue existing payment')
                  : method === 'USDC_BASE' && options.mode !== 'mock'
                    ? (pcm ? 'Connect wallet make we continue' : 'Connect wallet and continue')
                    : (pcm ? 'Continue make payment' : 'Continue to payment')}
            </button>
          </div>
        </>
      )}
      {actionError && <ErrorNotice message={actionError} />}
    </Modal>
  );
}
