import type { Payment, Reservation } from '@7even/contracts';
import { ArrowUpRight, Check, CircleAlert, FlaskConical, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ErrorNotice, Loading, Money, StatusBadge, useFeedback } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import { PublicFooter, PublicHeader } from '../public/PublicShell.tsx';

export function TestCheckoutPage() {
  const { showSuccess, showError } = useFeedback();
  const { paymentId } = useParams();
  const { session } = useSession();
  const { data, loading, error, reload } = useApi<Payment>(
    paymentId ? `/payments/${encodeURIComponent(paymentId)}` : null,
  );
  const [result, setResult] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const attempt = useRef<Record<string, string>>({});
  const payment = result ?? data;
  const allowed =
    session?.paymentMode === 'mock' &&
    session.environment !== 'production' &&
    payment?.mode === 'mock';
  async function complete(outcome: 'SUCCESS' | 'FAILURE') {
    if (!paymentId || !allowed) return;
    setBusy(true);
    setActionError(null);
    attempt.current[outcome] ??= crypto.randomUUID();
    try {
      const next = await api<Payment>(`/payments/${encodeURIComponent(paymentId)}/dev-complete`, {
        method: 'POST',
        body: { outcome },
        idempotencyKey: attempt.current[outcome],
      });
      setResult(next);
      if (next.status === 'PAID')
        showSuccess(
          'The local test payment is recorded as paid. Your booking status is shown on this page. No real money moved.',
          'Test payment recorded.',
        );
      else if (next.status === 'FAILED')
        showError(
          'The local test payment was marked failed. No real money moved. Check your booking before trying again.',
        );
      else
        showError(
          `The local test returned ${next.status.toLowerCase().replaceAll('_', ' ')}. Check the payment and booking records before another attempt. No real money moved.`,
        );
      reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'The local test could not finish. Check the payment status before trying again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="public-page customer-page">
      <PublicHeader />
      <main id="main-content" className="public-container payment-page">
        <div className="payment-mode-notice">
          <FlaskConical size={20} aria-hidden="true" />
          <div>
            <strong>Local test checkout</strong>
            <p>
              No real money moves here. This is a local development payment double. It does not
              prove provider sandbox or bank behavior.
            </p>
          </div>
        </div>
        {loading && <Loading />}
        {error && <ErrorNotice message={error} retry={reload} />}
        {payment &&
          (!allowed ? (
            <section className="payment-card" aria-labelledby="payment-unavailable-title">
              <h1 id="payment-unavailable-title">Continue from your bookings.</h1>
              <ErrorNotice message="This test checkout is unavailable. Only mock payments in a nonproduction environment can use this page. Open your bookings to continue through the configured payment provider." />
              <Link className="btn btn-primary" to="/app/bookings">
                View your bookings
              </Link>
            </section>
          ) : (
            <section className="payment-card" aria-labelledby="payment-title">
              <span className="public-eyebrow">7even / Development only</span>
              <h1 id="payment-title">Try the payment path.</h1>
              <p>
                Choose a provider outcome to test how your reservation changes. The server still
                checks the reservation and inventory.
              </p>
              <div className="payment-amount">
                <Money minor={payment.amountMinor} currency={payment.currency} />
              </div>
              <dl className="payment-details">
                <div>
                  <dt>Provider</dt>
                  <dd>
                    {payment.provider === 'paystack'
                      ? 'Paystack'
                      : payment.provider === 'crypto'
                        ? 'USDC on Base'
                        : 'Flutterwave'}{' '}
                    · local test
                  </dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>{payment.reference}</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    <StatusBadge status={payment.status} />
                  </dd>
                </div>
                <div>
                  <dt>
                    {payment.settlementKind === 'WALLET' ? 'Wallet delivery' : 'Bank settlement'}
                  </dt>
                  <dd>
                    <StatusBadge status={payment.settlementStatus} />
                  </dd>
                </div>
              </dl>
              {actionError && <ErrorNotice message={actionError} retry={reload} />}
              {result ? (
                <>
                  <ReservationOutcome payment={payment} />
                  <Link className="btn btn-primary" to="/app/bookings">
                    Back to your bookings <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <div className="payment-test-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || payment.status === 'PAID' || payment.status === 'REFUNDED'}
                    onClick={() => complete('SUCCESS')}
                  >
                    {busy ? 'Recording test result…' : 'Simulate successful payment'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy || payment.status === 'PAID' || payment.status === 'REFUNDED'}
                    onClick={() => complete('FAILURE')}
                  >
                    Simulate failed payment
                  </button>
                  <Link to="/app/bookings" className="public-text-link">
                    Leave without completing the test
                  </Link>
                </div>
              )}
            </section>
          ))}
      </main>
      <PublicFooter />
    </div>
  );
}

export function PaymentReturnPage() {
  const { showSuccess, showError } = useFeedback();
  const [params] = useSearchParams();
  const reference = params.get('tx_ref') ?? params.get('reference') ?? params.get('trxref');
  const transactionId = params.get('transaction_id');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(!!reference);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!reference) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const body = {
      reference,
      ...(transactionId && /^\d+$/.test(transactionId) ? { transactionId } : {}),
    };
    api<Payment>('/payments/verify', {
      method: 'POST',
      body,
      idempotencyKey: `verify:${reference}:${transactionId ?? 'none'}:${attempt}`,
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        setPayment(value);
        const outcome = `${value.id}:${value.status}`;
        if (announced.current === outcome) return;
        announced.current = outcome;
        if (value.status === 'PAID')
          showSuccess(
            'The server verified receipt of your payment. Your reservation and settlement status are shown on this page.',
            'Payment received.',
          );
        else if (value.status === 'FAILED')
          showError(
            'The provider reports that this payment failed. Check your booking before starting another payment.',
          );
        else if (['PENDING', 'UNKNOWN', 'REVIEW_REQUIRED'].includes(value.status))
          showError(
            'This payment is still being checked. Do not pay again while its outcome is uncertain. Your current records are shown on this page.',
          );
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'We could not check this payment yet. Open your bookings to see the latest status.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reference, transactionId, attempt, showSuccess, showError]);
  return (
    <div className="public-page customer-page">
      <PublicHeader />
      <main id="main-content" className="public-container payment-page">
        <section className="payment-card" aria-labelledby="payment-return-title">
          <ShieldCheck size={35} aria-hidden="true" />
          <span className="public-eyebrow">Back from payment</span>
          <h1 id="payment-return-title">
            {loading
              ? 'Checking your payment.'
              : payment?.status === 'PAID'
                ? 'Your payment was received.'
                : 'Your payment status.'}
          </h1>
          <p>
            7even checks the provider's result on the server. The redirect address alone is never
            proof of payment.
          </p>
          {loading && <Loading />}
          {error && <ErrorNotice message={error} retry={() => setAttempt((value) => value + 1)} />}
          {!reference && (
            <ErrorNotice message="This return link has no payment reference. Open your bookings to see the latest status." />
          )}
          {payment && (
            <>
              <div className="payment-amount">
                <Money minor={payment.amountMinor} />
              </div>
              <dl className="payment-details">
                <div>
                  <dt>Provider</dt>
                  <dd>
                    {payment.provider === 'paystack'
                      ? 'Paystack'
                      : payment.provider === 'crypto'
                        ? 'USDC on Base'
                        : 'Flutterwave'}
                  </dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>{payment.reference}</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    <StatusBadge status={payment.status} />
                  </dd>
                </div>
                <div>
                  <dt>
                    {payment.settlementKind === 'WALLET' ? 'Wallet delivery' : 'Bank settlement'}
                  </dt>
                  <dd>
                    <StatusBadge status={payment.settlementStatus} />
                  </dd>
                </div>
              </dl>
              <ReservationOutcome payment={payment} />
              {['PENDING', 'UNKNOWN', 'REVIEW_REQUIRED'].includes(payment.status) && (
                <>
                  <p className="customer-review-message">
                    This payment is still being checked. Do not pay again while its outcome is
                    uncertain.
                  </p>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={loading}
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Check again
                  </button>
                </>
              )}
            </>
          )}
          <Link className="btn btn-primary" to="/app/bookings">
            View your bookings <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function ReservationOutcome({ payment }: { payment: Payment }) {
  const { data, loading, error, reload } = useApi<Reservation>(
    `/reservations/${payment.reservationId}`,
  );
  return (
    <div className="payment-reservation-outcome">
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {data && (
        <>
          <div className="payment-reservation-title">
            {['CONFIRMED', 'CHECKED_IN', 'FULFILLED'].includes(data.status) ? (
              <Check size={20} aria-hidden="true" />
            ) : (
              <CircleAlert size={20} aria-hidden="true" />
            )}
            <h2>{data.title}</h2>
          </div>
          <p>
            {data.reference} <StatusBadge status={data.status} />
          </p>
          {data.status === 'PAYMENT_REVIEW' && (
            <p className="customer-review-message">
              Payment has been recorded, but the reservation needs review. Do not pay again. Your
              booking is not confirmed until this is resolved.
            </p>
          )}
          {data.status === 'CONFIRMED' && (
            <p>Your reservation is confirmed. The details are saved in your bookings.</p>
          )}
        </>
      )}
    </div>
  );
}
