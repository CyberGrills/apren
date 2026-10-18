import { useFeedback } from '../../components/Feedback.tsx';
import type { PaymentNote, Reservation } from '@7even/contracts';
import { useState } from 'react';
import { ErrorNotice, Field, Loading, Modal, Money } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import { majorToMinor } from '@7even/engine';
export function PaymentNotesDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const { data, loading, error, reload } = useApi<PaymentNote[]>(
    `/reception/reservations/${reservation.id}/payment-notes`,
  );
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [key, setKey] = useState(crypto.randomUUID());
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setFailure(null);
    try {
      await api(`/reception/reservations/${reservation.id}/payment-notes`, {
        method: 'POST',
        idempotencyKey: key,
        body: {
          amountMinor: majorToMinor(String(f.get('amount'))),
          method: String(f.get('method')),
          reference: String(f.get('reference') ?? ''),
          note: String(f.get('note') ?? ''),
        },
      });
      showSuccess('Your payment note has been recorded. Provider payment status is unchanged.');
      setKey(crypto.randomUUID());
      form.reset();
      reload();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Could not record the note.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Payment notes from the desk" onClose={onClose} busy={busy}>
      <p>
        {reservation.reference} · {reservation.customerName}
      </p>
      <p className="notice">
        A note records what reception observed. It does not mark a checkout payment paid, establish
        settlement or earn points. Keep bank and card details out of notes.
      </p>
      {loading && <Loading />}
      {error && <ErrorNotice message={error} />}
      {data?.map((note) => (
        <article className="panel" key={note.id}>
          <p>
            <Money minor={note.amountMinor} /> · {note.method.toLowerCase().replaceAll('_', ' ')}
          </p>
          <p className="small-copy">
            {note.reference} · {note.note}
            <br />
            Recorded by {note.recordedBy} on {new Date(note.recordedAt).toLocaleString('en-NG')}
          </p>
        </article>
      ))}
      <form className="form-stack" onSubmit={submit}>
        <Field label="Amount observed, naira">
          <input
            name="amount"
            inputMode="decimal"
            pattern="(0|[1-9][0-9]*)(\.[0-9]{1,2})?"
            required
          />
        </Field>
        <Field label="Method">
          <select name="method">
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer outside 7even</option>
            <option value="EXTERNAL_POS">External POS</option>
          </select>
        </Field>
        <Field label="Reference">
          <input name="reference" maxLength={120} />
        </Field>
        <Field label="Note">
          <textarea name="note" maxLength={500} />
        </Field>
        {failure && <ErrorNotice message={failure} />}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Recording…' : 'Record a payment note'}
        </button>
      </form>
    </Modal>
  );
}
