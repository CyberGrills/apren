import type { Checkout, Reservation } from '@7even/contracts';
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  EmptyState,
  ErrorNotice,
  Field,
  Modal,
  Money,
  StatusBadge,
  useFeedback,
} from '../../components/ui.tsx';
import { api, ApiError } from '../../lib/api.ts';
import { friendlyDate } from '../public/PublicShell.tsx';
import { openCheckout } from './checkout.ts';

export function BookingList({
  reservations,
  reload,
}: {
  reservations: Reservation[];
  reload: () => void;
}) {
  const { showSuccess } = useFeedback();
  const navigate = useNavigate();
  const [cancel, setCancel] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<Record<string, string>>({});
  function key(action: string) {
    attempt.current[action] ??= crypto.randomUUID();
    return attempt.current[action];
  }
  async function pay(reservation: Reservation) {
    setError(null);
    setBusy(reservation.id);
    try {
      const checkout = await api<Checkout>(`/reservations/${reservation.id}/checkout`, {
        method: 'POST',
        idempotencyKey: key(`checkout:${reservation.id}`),
      });
      openCheckout(checkout, navigate);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not open payment. Check this booking before trying again.',
      );
    } finally {
      setBusy(null);
    }
  }
  async function cancelBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancel) return;
    setBusy(cancel.id);
    setError(null);
    try {
      const result = await api<Reservation>(`/reservations/${cancel.id}/actions`, {
        method: 'POST',
        body: { action: 'CANCEL', expectedRevision: cancel.revision, reason: reason.trim() },
        idempotencyKey: key(`cancel:${cancel.id}:${cancel.revision}:${reason.trim()}`),
      });
      showSuccess(
        `${result.reference} is ${result.status.toLowerCase().replaceAll('_', ' ')}. Payment and refund status are shown separately.`,
        'Booking updated.',
      );
      setCancel(null);
      setReason('');
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not cancel this booking. Refresh it and try again.',
      );
      if (cause instanceof ApiError && cause.status === 409) {
        setCancel(null);
        reload();
      }
    } finally {
      setBusy(null);
    }
  }
  if (!reservations.length)
    return (
      <EmptyState
        title="A little space for your next plan."
        description="Your stays, tables and experiences will appear here once you make a reservation."
        action={
          <Link className="btn btn-primary" to="/explore">
            Find somewhere good <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        }
      />
    );
  return (
    <>
      {error && !cancel && <ErrorNotice message={error} retry={reload} />}
      <div className="customer-bookings">
        {reservations.map((reservation) => (
          <article className="customer-booking" key={reservation.id}>
            {reservation.image ? (
              <img src={reservation.image} alt="" width="400" height="300" loading="lazy" />
            ) : (
              <div className="customer-booking-placeholder">
                <CalendarDays size={32} aria-hidden="true" />
              </div>
            )}
            <div className="customer-booking-content">
              <div className="customer-booking-top">
                <span className="public-eyebrow">
                  {reservation.kind === 'STAY'
                    ? 'Your stay'
                    : reservation.kind === 'DINING'
                      ? 'Your table'
                      : 'Your experience'}{' '}
                  / {reservation.city}
                </span>
                <StatusBadge status={reservation.status} />
              </div>
              <h2>
                <Link to={`/places/${reservation.offeringId}`}>{reservation.title}</Link>
              </h2>
              <p className="customer-booking-date">
                {friendlyDate(reservation.startDate)}
                {reservation.endDate && ` to ${friendlyDate(reservation.endDate)}`}
                {reservation.kind !== 'STAY' &&
                  reservation.startAt &&
                  ` · ${new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(reservation.startAt))} WAT`}
              </p>
              <dl className="customer-booking-details">
                <div>
                  <dt>Reference</dt>
                  <dd>{reservation.reference}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>
                    <Money minor={reservation.price.totalMinor} />
                  </dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    <StatusBadge status={reservation.paymentStatus} />
                  </dd>
                </div>
                <div>
                  <dt>Settlement</dt>
                  <dd>
                    <StatusBadge status={reservation.settlementStatus} />
                  </dd>
                </div>
              </dl>
              {reservation.status === 'HELD' && (
                <p className="public-small">
                  {reservation.holdExpiresAt
                    ? `Held until ${new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(reservation.holdExpiresAt))} WAT.`
                    : 'Your reservation is awaiting payment.'}{' '}
                  Confirmation depends on verified payment and availability.
                </p>
              )}
              {reservation.status === 'PAYMENT_REVIEW' && (
                <p className="customer-review-message">
                  This payment needs review. Do not pay again. Your booking is not confirmed while
                  the issue is being checked.
                </p>
              )}
              <div className="customer-booking-actions">
                {reservation.status === 'HELD' &&
                  ['UNPAID', 'PENDING', 'FAILED'].includes(reservation.paymentStatus) && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy === reservation.id}
                      onClick={() => pay(reservation)}
                    >
                      {busy === reservation.id ? 'Opening payment…' : 'Continue to payment'}
                    </button>
                  )}
                {['HELD', 'CONFIRMED'].includes(reservation.status) && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setCancel(reservation);
                      setError(null);
                      setReason('');
                    }}
                  >
                    Cancel booking
                  </button>
                )}
                <Link className="public-text-link" to={`/places/${reservation.offeringId}`}>
                  View the place <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      {cancel && (
        <Modal
          title="Cancel this booking?"
          busy={!!busy}
          onClose={() => {
            if (!busy) setCancel(null);
          }}
        >
          <form onSubmit={cancelBooking}>
            <p>
              {cancel.title} · {cancel.reference}
            </p>
            <p className="public-small">
              The business's cancellation policy applies. If a refund is due, it will be tracked
              separately. This action does not promise an immediate refund.
            </p>
            <Field label="Reason for cancelling">
              <textarea
                className="field-input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={3}
                maxLength={500}
                required
                rows={3}
              />
            </Field>
            {error && <ErrorNotice message={error} retry={reload} />}
            <div className="customer-modal-actions">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={!!busy}
                onClick={() => setCancel(null)}
              >
                Keep booking
              </button>
              <button className="btn btn-primary" type="submit" disabled={!!busy}>
                {busy ? 'Cancelling…' : 'Cancel booking'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
