import { useFeedback } from '../../components/Feedback.tsx';
import type { Offering, Quote, ReceptionOverview, Reservation, SyncResult } from '@7even/contracts';
import { Plus, RefreshCw, TicketCheck, WifiOff } from 'lucide-react';
import { PaymentMethodDialog } from '../../components/PaymentMethodDialog.tsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  Money,
  PageHeader,
  StatusBadge,
} from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import {
  applySyncResults,
  readQueue,
  mutateQueue,
  appendQueue,
  type StoredAction,
} from '../../lib/receptionQueue.ts';
import { PaymentNotesDialog } from './PaymentNotesDialog.tsx';
import { localDateNow } from '../public/PublicShell.tsx';
import {
  MetricsStrip,
  ReservationActionDialog,
  ReservationTable,
  type ReservationCommand,
} from './shared.tsx';

export function ReceptionPage() {
  const { user } = useSession();
  const { data, loading, error, reload } = useApi<ReceptionOverview>('/reception/overview');
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<StoredAction[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const automaticBatch = useRef('');
  const [command, setCommand] = useState<ReservationCommand | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [notes, setNotes] = useState<Reservation | null>(null);
  const [consume, setConsume] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('today');
  const scope =
    user?.businessId && data?.sourceId ? `${user.id}:${user.businessId}:${data.sourceId}` : null;
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setQueue([]);
    if (scope)
      void readQueue(scope)
        .then((items) => {
          if (active) setQueue(items);
        })
        .catch((cause: Error) => setQueueError(cause.message));
    return () => {
      active = false;
    };
  }, [scope]);
  const sync = useCallback(async () => {
    if (!scope || !data?.sourceId || !navigator.onLine || syncingRef.current) return;
    setQueueError(null);
    syncingRef.current = true;
    setSyncing(true);
    try {
      const stored = await readQueue(scope);
      const pending = stored.filter((item) => item.state === 'PENDING');
      if (!pending.length) return;
      const batch = pending.slice(0, 50);
      const result = await api<SyncResult>('/reception/sync', {
        method: 'POST',
        idempotencyKey: batch[0]!.event.eventId,
        body: { sourceId: data.sourceId, events: batch.map((item) => item.event) },
      });
      const next = await mutateQueue(scope, (current) => applySyncResults(current, result));
      setQueue(next);
      setQueueError(null);
      reload();
    } catch (cause) {
      setQueueError(cause instanceof Error ? cause.message : 'Could not send queued actions.');
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [scope, data?.sourceId, reload]);
  useEffect(() => {
    const identity = queue
      .filter((item) => item.state === 'PENDING')
      .map((item) => item.event.eventId)
      .join(':');
    if (!online) automaticBatch.current = '';
    if (online && identity && automaticBatch.current !== identity) {
      automaticBatch.current = identity;
      void sync();
    }
  }, [online, queue, sync]);
  async function execute({ reservation, action }: ReservationCommand, reason: string, key: string) {
    if (action === 'REFUND')
      throw new Error('Open the business dashboard to review and request a refund.');
    if (action === 'CANCEL') {
      if (!navigator.onLine) throw new Error('Reconnect before cancelling a reservation.');
      await api(`/reservations/${reservation.id}/actions`, {
        method: 'POST',
        idempotencyKey: key,
        body: { action, expectedRevision: reservation.revision, reason },
      });
      return;
    }
    if (!scope || !data?.sourceId)
      throw new Error('The reception source is unavailable. Reconnect and refresh.');
    const next = await appendQueue(scope, {
      event: {
        eventId: crypto.randomUUID(),
        schemaVersion: 1,
        reservationId: reservation.id,
        expectedRevision: reservation.revision,
        action,
        occurredAt: new Date().toISOString(),
      },
      state: 'PENDING',
    });
    setQueue(next);
  }
  async function dismiss(eventId: string) {
    if (!scope) return;
    setQueueError(null);
    try {
      const next = await mutateQueue(scope, (current) =>
        current.filter((item) => item.event.eventId !== eventId),
      );
      setQueue(next);
      reload();
    } catch (cause) {
      setQueueError(
        cause instanceof Error ? cause.message : 'Could not dismiss this queued action.',
      );
    }
  }
  const today = localDateNow();
  const reservations =
    data?.reservations.filter(
      (r) =>
        `${r.customerName} ${r.reference} ${r.title}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (tab === 'all' ||
          (tab === 'today'
            ? r.startDate === today || r.status === 'CHECKED_IN'
            : r.status === tab)),
    ) ?? [];
  return (
    <>
      <PageHeader
        eyebrow={data?.business?.businessName ?? 'Reception'}
        title="Welcome them well."
        description="Your arrivals, service updates and walk-ins, connected to the same availability."
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!online}
              onClick={() => setConsume(true)}
            >
              <TicketCheck size={17} />
              Use a benefit
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!online}
              onClick={() => setWalkIn(true)}
            >
              <Plus size={17} />
              New walk-in
            </button>
          </>
        }
      />
      {!online && (
        <p className="notice">
          <WifiOff size={16} /> Offline. Service updates can be queued. New bookings, payments and
          benefit use need a connection. Queued changes are not confirmed until the server accepts
          them.
        </p>
      )}
      {queue.length > 0 && (
        <section className="queue-panel" aria-label="Pending reception actions">
          <div className="section-heading">
            <h2>
              {queue.length} {queue.length === 1 ? 'action' : 'actions'} to resolve
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={!online || syncing}
              onClick={() => void sync()}
            >
              <RefreshCw size={14} />
              {syncing ? 'Sending…' : 'Send pending'}
            </button>
          </div>
          {queue.map((item) => (
            <div className="queue-item" key={item.event.eventId}>
              <div>
                <p>
                  {item.event.action.toLowerCase().replaceAll('_', ' ')} ·{' '}
                  {data?.reservations.find((r) => r.id === item.event.reservationId)?.reference ??
                    item.event.reservationId.slice(0, 8)}
                </p>
                {item.message && <p>{item.message}</p>}
              </div>
              <StatusBadge status={item.state} />
              {item.state !== 'PENDING' && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void dismiss(item.event.eventId)}
                >
                  Dismiss and refresh
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {queueError && <ErrorNotice message={queueError} retry={() => void sync()} />}
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {data && (
        <>
          <MetricsStrip metrics={data.metrics} />
          <div className="toolbar">
            <div className="desk-tabs">
              {[
                ['today', 'Today'],
                ['CONFIRMED', 'Expected'],
                ['CHECKED_IN', 'Checked in'],
                ['FULFILLED', 'Completed'],
                ['all', 'All records'],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={tab === value ? 'active' : ''}
                  aria-pressed={tab === value}
                  onClick={() => setTab(value!)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              aria-label="Find a guest"
              placeholder="Find a guest or reference"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {reservations.length ? (
            <ReservationTable
              showRefund={false}
              onNotes={setNotes}
              reservations={reservations}
              onAction={(next) => {
                if (next.action !== 'REFUND') setCommand(next);
              }}
            />
          ) : (
            <EmptyState
              title="A clear desk."
              description="No reservations match this view. A new walk-in uses the same live capacity as an online booking."
            />
          )}
          <p className="small-copy">
            Last server response:{' '}
            {new Intl.DateTimeFormat('en-NG', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZone: 'Africa/Lagos',
            }).format(new Date(data.serverTime))}
            . Connected views refresh automatically while visible.
          </p>
        </>
      )}
      {command && (
        <ReservationActionDialog
          command={command}
          onClose={() => setCommand(null)}
          onDone={reload}
          execute={execute}
        />
      )}
      {notes && <PaymentNotesDialog reservation={notes} onClose={() => setNotes(null)} />}
      {walkIn && data && (
        <WalkInDialog offerings={data.offerings} onClose={() => setWalkIn(false)} onDone={reload} />
      )}
      {consume && <ConsumeDialog onClose={() => setConsume(false)} onDone={reload} />}
    </>
  );
}
function WalkInDialog({
  offerings,
  onClose,
  onDone,
}: {
  offerings: Offering[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [offeringId, setOfferingId] = useState(offerings[0]?.id ?? '');
  const offer = offerings.find((item) => item.id === offeringId);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(crypto.randomUUID());
  const [customer, setCustomer] = useState({ email: '', name: '' });
  async function getQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      setCustomer({ email: String(f.get('email')), name: String(f.get('name')) });
      const result = await api<Quote>('/quotes', {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: {
          offeringId,
          startDate: String(f.get('startDate')),
          ...(offer?.kind === 'STAY'
            ? { endDate: String(f.get('endDate')) }
            : { windowId: String(f.get('windowId')) }),
          quantity: Number(f.get('quantity')),
        },
      });
      setQuote(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not quote this visit.');
    } finally {
      setBusy(false);
    }
  }
  async function reserve() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api<Reservation>('/reception/walk-ins', {
        method: 'POST',
        idempotencyKey: key,
        body: { quoteId: quote.id, customerEmail: customer.email, customerName: customer.name },
      });
      setReservation(next);
      showSuccess(
        'Capacity is held until the stated expiry. Continue to checkout to confirm the visit.',
        'A place is held.',
      );
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not hold this visit.');
    } finally {
      setBusy(false);
    }
  }
  if (paymentOpen && reservation)
    return <PaymentMethodDialog reservation={reservation} onClose={() => setPaymentOpen(false)} />;
  return (
    <Modal
      title={
        reservation ? 'A place is held.' : quote ? 'Review the walk-in.' : 'Welcome a walk-in.'
      }
      onClose={onClose}
      busy={busy}
    >
      {!quote && (
        <form className="form-grid" onSubmit={getQuote}>
          <div className="form-wide">
            <Field label="Place">
              <select value={offeringId} onChange={(e) => setOfferingId(e.target.value)} required>
                {offerings
                  .filter((o) => o.published)
                  .map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.title}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <Field label="Guest name">
            <input name="name" required minLength={2} maxLength={100} />
          </Field>
          <Field label="Guest email">
            <input name="email" type="email" required />
          </Field>
          <Field label={offer?.kind === 'STAY' ? 'Check-in' : 'Service date'}>
            <input
              name="startDate"
              type="date"
              min={localDateNow()}
              defaultValue={localDateNow()}
              required
            />
          </Field>
          {offer?.kind === 'STAY' ? (
            <Field label="Check-out">
              <input name="endDate" type="date" min={localDateNow()} required />
            </Field>
          ) : (
            <Field label="Service window">
              <select name="windowId" required>
                <option value="">Choose a sitting or occurrence</option>
                {offer?.windows.map((w) => (
                  <option value={w.id} key={w.id}>
                    {w.serviceDate} ·{' '}
                    {new Intl.DateTimeFormat('en-NG', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Africa/Lagos',
                    }).format(new Date(w.startAt))}{' '}
                    · {w.remaining} left
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={offer?.kind === 'STAY' ? 'Rooms' : 'Guests'}>
            <input name="quantity" type="number" required min={1} max={100} defaultValue={1} />
          </Field>
          <div className="form-wide form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !offer}>
              {busy ? 'Checking…' : 'Check price and availability'}
            </button>
          </div>
        </form>
      )}
      {quote && (
        <div className="stack">
          <p>
            {quote.title} · {customer.name}
          </p>
          <div className="panel">
            <p>
              Service <Money minor={quote.price.serviceMinor} />
            </p>
            <p>
              Tax <Money minor={quote.price.taxMinor} />
            </p>
            <strong>
              Total <Money minor={quote.price.totalMinor} />
            </strong>
          </div>
          <p className="small-copy">
            {reservation
              ? `Reference ${reservation.reference}. The hold expires at ${new Date(reservation.holdExpiresAt!).toLocaleTimeString('en-NG')}. Payment must be verified before confirmation.`
              : 'The server will hold capacity when you continue. This quote alone does not reserve it.'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              if (reservation) setPaymentOpen(true);
              else void reserve();
            }}
          >
            {busy ? 'Working…' : reservation ? 'Continue to payment' : 'Hold this visit'}
          </button>
        </div>
      )}
      {error && <ErrorNotice message={error} />}
    </Modal>
  );
}
function ConsumeDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [key] = useState(crypto.randomUUID());
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api(`/benefits/${String(f.get('benefitId')).trim()}/consume`, {
        method: 'POST',
        idempotencyKey: key,
        body: { code: String(f.get('code')).trim(), expectedRevision: Number(f.get('revision')) },
      });
      setSuccess(true);
      showSuccess('The benefit has been used. Its previous code is no longer valid.');
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not use the benefit.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Use a guest’s benefit" onClose={onClose} busy={busy}>
      {success ? (
        <p className="small-copy">This form is complete.</p>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <p className="small-copy">
            Ask the guest to open their benefit. Check its ID, current revision and code. The server
            checks ownership, expiry and your business.
          </p>
          <Field label="Benefit ID">
            <input name="benefitId" required />
          </Field>
          <Field label="Redemption code">
            <input name="code" required minLength={8} maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Revision">
            <input name="revision" type="number" min={0} required />
          </Field>
          {error && <ErrorNotice message={error} />}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Checking…' : 'Use benefit'}
          </button>
        </form>
      )}
    </Modal>
  );
}
