import { useFeedback } from '../../components/Feedback.tsx';
import type { Activity, Metrics, Payment, Reservation } from '@7even/contracts';
import { useState } from 'react';
import { ErrorNotice, Field, Metric, Modal, Money, StatusBadge } from '../../components/ui.tsx';
import { api } from '../../lib/api.ts';
import { CryptoRefundDialog } from './CryptoRefundDialog.tsx';
export function dateLabel(value: string | null) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
export function MetricsStrip({ metrics, admin = false }: { metrics: Metrics; admin?: boolean }) {
  return (
    <div className="metrics-grid">
      <Metric
        label={admin ? 'Reservations' : 'Confirmed reservations'}
        value={admin ? metrics.totalReservations : metrics.confirmedReservations}
        note="Recorded in 7even"
      />
      <Metric
        label="Verified payments"
        value={<Money minor={metrics.grossMinor} />}
        note="Payment success is separate from bank or wallet delivery"
      />
      <Metric
        label={admin ? '7even commission' : 'Arrivals today'}
        value={admin ? <Money minor={metrics.commissionMinor} /> : metrics.arrivalsToday}
        note={admin ? '10% of discounted service, before tax' : 'Africa/Lagos local date'}
      />
      <Metric
        label="Completed services"
        value={metrics.fulfilledReservations}
        note={`${metrics.pointsIssued.toLocaleString('en-NG')} points issued`}
      />
    </div>
  );
}
export function ActivityList({ items }: { items: Activity[] }) {
  return (
    <ul className="activity-list">
      {items.length === 0 && <li>No activity has been recorded yet.</li>}
      {items.slice(0, 30).map((item) => (
        <li key={item.id}>
          <span>
            {item.action.replaceAll('.', ' · ').replaceAll('_', ' ')}
            <small>
              {item.actorName}
              {item.detail ? ` · ${item.detail}` : ''}
            </small>
          </span>
          <small>{dateLabel(item.createdAt)}</small>
        </li>
      ))}
    </ul>
  );
}
export interface ReservationCommand {
  reservation: Reservation;
  action: 'CHECK_IN' | 'FULFILL' | 'CANCEL' | 'REFUND';
  paymentId?: string;
}
export function ReservationTable({
  reservations,
  onAction,
  showRefund = true,
  onNotes,
}: {
  reservations: Reservation[];
  onAction?: (command: ReservationCommand) => void;
  showRefund?: boolean;
  onNotes?: (reservation: Reservation) => void;
}) {
  return (
    <section
      className="table-wrap"
      aria-label="Reservations. Scroll horizontally to see payment and actions."
      data-scrolls
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the reservation table.
      tabIndex={0}
    >
      {reservations.length > 0 && (
        <p className="table-scroll-cue">Scroll table for payment and actions →</p>
      )}
      <table>
        <thead>
          <tr>
            <th>Guest / reference</th>
            <th>Plan</th>
            <th>Service date</th>
            <th>Reservation</th>
            <th>Payment</th>
            <th>Total / action</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.customerName}</strong>
                <small>{r.reference}</small>
              </td>
              <td>
                <strong>{r.title}</strong>
                <small>
                  {r.quantity}{' '}
                  {r.kind === 'STAY' ? 'room(s)' : r.kind === 'DINING' ? 'guest(s)' : 'seat(s)'}
                </small>
              </td>
              <td>
                {dateLabel(r.startDate)}
                {r.endDate && <small>to {dateLabel(r.endDate)}</small>}
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td>
                <StatusBadge status={r.paymentStatus} />
                <small>{r.settlementStatus.toLowerCase()}</small>
              </td>
              <td>
                <Money minor={r.price.totalMinor} />
                {onAction && (
                  <div className="row-actions">
                    {onNotes && (
                      <button type="button" className="text-button" onClick={() => onNotes(r)}>
                        Payment notes
                      </button>
                    )}
                    {r.status === 'CONFIRMED' && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          onAction({
                            reservation: r,
                            action: r.kind === 'STAY' ? 'CHECK_IN' : 'FULFILL',
                          })
                        }
                      >
                        {r.kind === 'STAY' ? 'Check in' : 'Complete'}
                      </button>
                    )}
                    {r.status === 'CHECKED_IN' && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onAction({ reservation: r, action: 'FULFILL' })}
                      >
                        Complete
                      </button>
                    )}
                    {['HELD', 'CONFIRMED'].includes(r.status) && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onAction({ reservation: r, action: 'CANCEL' })}
                      >
                        Cancel
                      </button>
                    )}
                    {showRefund &&
                      ['PAID', 'REVIEW_REQUIRED', 'REFUND_PENDING'].includes(r.paymentStatus) && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => onAction({ reservation: r, action: 'REFUND' })}
                        >
                          {r.paymentStatus === 'REFUND_PENDING' ? 'Continue refund' : 'Refund'}
                        </button>
                      )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reservations.length === 0 && (
        <p className="small-copy panel">No reservations match this view.</p>
      )}
    </section>
  );
}
export function ReservationActionDialog({
  command,
  onClose,
  onDone,
  execute,
}: {
  command: ReservationCommand;
  onClose: () => void;
  onDone: () => void;
  execute?: (command: ReservationCommand, reason: string, key: string) => Promise<void>;
}) {
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(crypto.randomUUID());
  const [cryptoRefundId, setCryptoRefundId] = useState<string | null>(null);
  const { reservation: r, action } = command;
  const title =
    action === 'CHECK_IN'
      ? 'Check in this guest?'
      : action === 'FULFILL'
        ? 'Mark this service complete?'
        : action === 'REFUND'
          ? 'Request a full refund?'
          : 'Cancel this reservation?';
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
    try {
      if (execute) await execute(command, reason, key);
      else {
        const result = await api<Payment | Reservation>(
          `/reservations/${r.id}/${action === 'REFUND' ? 'refunds' : 'actions'}`,
          {
            method: 'POST',
            idempotencyKey: key,
            body:
              action === 'REFUND'
                ? { reason, ...(command.paymentId ? { paymentId: command.paymentId } : {}) }
                : { action, expectedRevision: r.revision, ...(reason ? { reason } : {}) },
          },
        );
        if (action === 'REFUND' && 'crypto' in result && result.crypto?.refund) {
          setCryptoRefundId(result.id);
          onDone();
          return;
        }
      }
      showSuccess(
        action === 'REFUND'
          ? 'The refund request has been recorded. The payment record shows its provider status.'
          : execute && action !== 'CANCEL'
            ? 'Your service update is queued. The reservation changes when the server accepts it.'
            : 'The reservation has been updated.',
        execute && action !== 'CANCEL' ? 'Update queued.' : 'Recorded.',
      );
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the reservation.');
    } finally {
      setBusy(false);
    }
  }
  if (cryptoRefundId)
    return <CryptoRefundDialog paymentId={cryptoRefundId} onClose={onClose} onDone={onDone} />;
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <p>
        {r.customerName} · {r.title}
      </p>
      <p className="small-copy">
        {r.reference} · {dateLabel(r.startDate)}
      </p>
      {action === 'FULFILL' && (
        <p className="notice">
          Confirm that the service has been delivered. Points are issued only when the server has
          also verified the payment.
        </p>
      )}
      {action === 'REFUND' && (
        <p className="notice">
          The server will check eligibility and the provider response. A request does not mean that
          the bank or business wallet has delivered the refund. Uncertain requests remain under
          review.
        </p>
      )}
      <form className="form-stack" onSubmit={submit}>
        {['CANCEL', 'REFUND'].includes(action) && (
          <Field label="Reason">
            <textarea name="reason" minLength={3} maxLength={500} required />
          </Field>
        )}
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
            Go back
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : action === 'REFUND' ? 'Request refund' : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
