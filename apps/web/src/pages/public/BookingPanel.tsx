import type { Offering, Quote, Reservation } from '@7even/contracts';
import { ArrowUpRight, LockKeyhole } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PaymentMethodDialog } from '../../components/PaymentMethodDialog.tsx';
import { ErrorNotice, Field, Money } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../lib/api.ts';
import { recordRecoveryEvent, recoverySessionId } from '../../lib/recoveryTelemetry.ts';
import { addDays, friendlyDate, localDateNow } from './PublicShell.tsx';
import { useSevenLanguage } from '../../lib/sevenLanguage.ts';

export function BookingPanel({ offering }: { offering: Offering }) {
  const language = useSevenLanguage();
  const pcm = language === 'pcm';
  const { user } = useSession();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get('startDate') ?? '';
  const selectedDate =
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= localDateNow()
      ? requestedDate
      : '';
  const requestedEnd = searchParams.get('endDate') ?? '';
  const firstWindow = offering.windows.find(
    (window) =>
      window.remaining > 0 &&
      window.serviceDate >= localDateNow() &&
      (!selectedDate || window.serviceDate === selectedDate),
  );
  const [startDate, setStartDate] = useState(
    selectedDate || firstWindow?.serviceDate || localDateNow(),
  );
  const [endDate, setEndDate] = useState(
    requestedEnd &&
      /^\d{4}-\d{2}-\d{2}$/.test(requestedEnd) &&
      requestedEnd > (selectedDate || firstWindow?.serviceDate || localDateNow())
      ? requestedEnd
      : addDays(selectedDate || firstWindow?.serviceDate || localDateNow(), 1),
  );
  const [windowId, setWindowId] = useState(firstWindow?.id ?? '');
  const requestedRooms = Number(searchParams.get('rooms') ?? '1');
  const initialQuantity = Number.isSafeInteger(requestedRooms) && requestedRooms >= 1 && requestedRooms <= 100
    ? String(requestedRooms)
    : '1';
  const [quantity, setQuantity] = useState(initialQuantity);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [held, setHeld] = useState<Reservation | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStay = offering.kind === 'STAY';
  const paymentButtonRef = useRef<HTMLButtonElement>(null);
  const recoveryStarted = useRef(false);
  const recoveryCheckoutViewed = useRef(false);
  const recoveryHeld = useRef(false);
  useEffect(() => {
    const onPageHide = () => {
      if (recoveryStarted.current && recoveryCheckoutViewed.current && !recoveryHeld.current && isStay) {
        void recordRecoveryEvent({ offeringId: offering.id, event: 'ABANDON', keepalive: true });
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [offering.id, isStay]);
  const keys = useRef({
    quote: crypto.randomUUID(),
    reserve: crypto.randomUUID(),
    checkout: crypto.randomUUID(),
  });
  function clearQuote() {
    setQuote(null);
    setPolicyAccepted(false);
    setError(null);
    keys.current = {
      quote: crypto.randomUUID(),
      reserve: crypto.randomUUID(),
      checkout: crypto.randomUUID(),
    };
  }
  async function getQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    if (isStay && !recoveryStarted.current) {
      recoveryStarted.current = true;
      void recordRecoveryEvent({ offeringId: offering.id, event: 'BOOKING_START' });
    }
    try {
      const body = {
        offeringId: offering.id,
        ...(isStay ? { recoverySessionId: recoverySessionId() } : {}),
        startDate,
        quantity: Number(quantity),
        ...(isStay ? { endDate } : { windowId }),
      };
      const nextQuote = await api<Quote>('/quotes', {
        method: 'POST',
        body,
        idempotencyKey: quote ? crypto.randomUUID() : keys.current.quote,
      });
      keys.current.reserve = crypto.randomUUID();
      keys.current.checkout = crypto.randomUUID();
      setQuote(nextQuote);
      setPolicyAccepted(false);
      if (isStay) {
        recoveryCheckoutViewed.current = true;
        void recordRecoveryEvent({
          offeringId: offering.id,
          event: 'CHECKOUT_VIEW',
          amountMinor: nextQuote.price.totalMinor,
        });
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'We could not check this price. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const reservation =
        held ??
        (await api<Reservation>('/reservations', {
          method: 'POST',
          body: { quoteId: quote.id },
          idempotencyKey: keys.current.reserve,
        }));
      recoveryHeld.current = true;
      setHeld(reservation);
      setPaymentOpen(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not open payment. Check your bookings before starting another reservation.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (offering.isSample) {
    return (
      <aside className="booking-panel booking-panel-unavailable" aria-labelledby="booking-title">
        <div className="booking-panel-top">
          <span className="public-eyebrow">{pcm ? 'Sample listing' : 'Sample listing'}</span>
          <h2 id="booking-title">{pcm ? 'Booking no dey available' : 'Booking unavailable'}</h2>
        </div>
        <p role="status">
          {pcm
            ? 'Na sample listing be this, e no be confirmed hotel availability. We don disable dates, room numbers, price checks, reservations and payment until we verify the property.'
            : 'This is an illustrative listing, not verified live inventory. Dates, room counts, quotes, reservations, and payment are disabled until the property is verified.'}
        </p>
        <Link className="btn btn-secondary booking-cta" to="/explore?kind=STAY">
          {pcm ? 'See places wey you fit stay' : 'Browse stays'}
        </Link>
      </aside>
    );
  }

  return (
    <aside className="booking-panel" aria-labelledby="booking-title">
      <div className="booking-panel-top">
        <span className="public-eyebrow">{pcm ? 'Make your plan' : 'Make a plan'}</span>
        <h2 id="booking-title">
          <Money minor={offering.priceMinor} currency={offering.currency} />
          <small>{offering.unitLabel}</small>
        </h2>
      </div>
      <form onSubmit={getQuote}>
        <fieldset disabled={busy || !!held} className="booking-fieldset">
          {isStay ? (
            <div className="public-form-row">
              <Field label={pcm ? 'When you go enter' : 'Check-in'}>
                <input
                  className="field-input"
                  type="date"
                  min={localDateNow()}
                  value={startDate}
                  required
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value >= endDate) setEndDate(addDays(e.target.value, 1));
                    clearQuote();
                  }}
                />
              </Field>
              <Field label={pcm ? 'When you go comot' : 'Check-out'}>
                <input
                  className="field-input"
                  type="date"
                  min={addDays(startDate, 1)}
                  value={endDate}
                  required
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    clearQuote();
                  }}
                />
              </Field>
            </div>
          ) : (
            <Field label={pcm ? 'Choose date and time' : 'Choose a date and time'}>
              <select
                className="field-input"
                required
                value={windowId}
                onChange={(e) => {
                  const selected = offering.windows.find((window) => window.id === e.target.value);
                  setWindowId(e.target.value);
                  if (selected) setStartDate(selected.serviceDate);
                  clearQuote();
                }}
              >
                <option value="">{pcm ? 'Choose available time' : 'Choose an available time'}</option>
                {offering.windows
                  .filter((window) => window.remaining > 0 && window.serviceDate >= localDateNow())
                  .map((window) => (
                    <option key={window.id} value={window.id}>
                      {friendlyDate(window.serviceDate)} ·{' '}
                      {new Intl.DateTimeFormat('en-NG', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'Africa/Lagos',
                      }).format(new Date(window.startAt))}{' '}
                      · {window.remaining} available
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field
            label={isStay ? (pcm ? 'How many rooms?' : 'Rooms') : (pcm ? 'How many people?' : 'Guests')}
            hint={pcm ? `You fit book up to ${Math.min(100, offering.capacity)} for one reservation.` : `Up to ${Math.min(100, offering.capacity)} per reservation.`}
          >
            <input
              className="field-input"
              type="number"
              value={quantity}
              min={1}
              max={Math.min(100, offering.capacity)}
              required
              onChange={(e) => {
                setQuantity(e.target.value);
                clearQuote();
              }}
            />
          </Field>
        </fieldset>
        {!user ? (
          <Link
            className="btn btn-primary booking-cta"
            to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
          >
            Sign in to check the full price <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        ) : (
          !held && (
            <button
              className="btn btn-secondary booking-cta"
              type="submit"
              disabled={busy || (!isStay && !windowId)}
            >
              {busy ? 'Checking…' : quote ? 'Check price again' : 'See the full price'}
            </button>
          )
        )}
      </form>
      {quote && (
        <div className="quote-breakdown" aria-live="polite">
          <p className="public-eyebrow">{pcm ? 'Wetin you go pay' : 'Your price'}</p>
          <dl>
            <div>
              <dt>
                {quote.quantity} × {quote.units}{' '}
                {isStay
                  ? (pcm ? (quote.units === 1 ? 'night' : 'nights') : (quote.units === 1 ? 'night' : 'nights'))
                  : (pcm ? 'booking units' : 'booking units')}
              </dt>
              <dd>
                <Money minor={quote.price.subtotalMinor} />
              </dd>
            </div>
            {quote.price.discountMinor !== '0' && (
              <div>
                <dt>{pcm ? 'Discount' : 'Discount'}</dt>
                <dd>
                  −<Money minor={quote.price.discountMinor} />
                </dd>
              </div>
            )}
            {quote.price.serviceMinor !== '0' && (
              <div>
                <dt>{pcm ? 'Service charge' : 'Service fee'}</dt>
                <dd>
                  <Money minor={quote.price.serviceMinor} />
                </dd>
              </div>
            )}
            <div>
              <dt>{pcm ? 'Tax' : 'Tax'}</dt>
              <dd>
                <Money minor={quote.price.taxMinor} />
              </dd>
            </div>
            <div className="quote-total">
              <dt>{pcm ? 'Total' : 'Total'}</dt>
              <dd>
                <Money minor={quote.price.totalMinor} />
              </dd>
            </div>
          </dl>
          <p className="public-small">
            {held
              ? (pcm
                  ? `We dey hold am till ${new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(held.holdExpiresAt ?? quote.expiresAt))} WAT. We go confirm your booking after payment don verify.`
                  : `Held until ${new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(held.holdExpiresAt ?? quote.expiresAt))} WAT. Your booking is confirmed after payment is verified.`)
              : (pcm ? 'This price go expire soon. We go hold availability only when you continue.' : 'This price expires shortly. Availability is held only when you continue.')}
          </p>
          <label className="checkout-policy-acceptance">
            <input
              type="checkbox"
              checked={policyAccepted}
              onChange={(event) => setPolicyAccepted(event.target.checked)}
              disabled={busy}
            />
            <span>
              {pcm
                ? `I don check the cancellation rule (${offering.cancellationHours} hours before the booking starts). I understand say this booking no confirm until 7even verify my payment.`
                : `I have reviewed the cancellation policy (${offering.cancellationHours} hours before the booking starts) and understand that this reservation is not confirmed until 7even verifies my payment.`}
            </span>
          </label>
          <button
            type="button"
            className="btn btn-primary booking-cta"
            ref={paymentButtonRef}
            onClick={checkout}
            disabled={busy || !policyAccepted}
          >
            {busy
              ? (pcm ? 'We dey open payment…' : 'Opening payment…')
              : held
                ? (pcm ? 'Continue make payment' : 'Continue to payment')
                : (pcm ? 'Reserve and continue make payment' : 'Reserve and continue to payment')}
            <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        </div>
      )}
      {error && <ErrorNotice message={error} />}
      {held && (
        <Link className="public-text-link" to="/app/bookings">
          {pcm ? 'See am for your bookings' : 'View this in your bookings'}
        </Link>
      )}
      <p className="booking-assurance">
        <LockKeyhole size={15} aria-hidden="true" /> {pcm ? 'We dey verify payment securely.' : 'Payments are checked on the server.'}
      </p>
      <p className="public-small">
        {pcm
          ? `Cancellation rule: cancel at least ${offering.cancellationHours} hours before the booking starts. The business own policy still apply.`
          : `Cancellation rules: ${offering.cancellationHours} hours before the booking starts. The business's policy applies.`}
      </p>
      {paymentOpen && held && (
        <PaymentMethodDialog
          reservation={held}
          onClose={() => setPaymentOpen(false)}
          returnFocusRef={paymentButtonRef}
        />
      )}
    </aside>
  );
}
