import { useFeedback } from '../../components/Feedback.tsx';
import type { Venue } from '@7even/contracts';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { ErrorNotice, Field, Loading, Modal, PageHeader } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
export function VenuesPage() {
  const { data, loading, error, reload } = useApi<Venue[]>('/business/venues');
  const [selected, setSelected] = useState<Venue | 'new' | null>(null);
  return (
    <>
      <PageHeader
        eyebrow="Your business"
        title="A place for every guest."
        description="Keep each address under the same business. Reception access can be limited to a venue."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setSelected('new')}>
            <Plus size={16} />
            Add a venue
          </button>
        }
      />
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      <div className="work-offering-grid">
        {data?.map((venue) => (
          <article className="panel" key={venue.id}>
            <p className="eyebrow">{venue.city}</p>
            <h2>{venue.venueName}</h2>
            <p>{venue.address}</p>
            <p className="small-copy">Local time: {venue.timeZone}</p>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setSelected(venue)}
            >
              Edit venue
            </button>
          </article>
        ))}
      </div>
      {selected && (
        <VenueEditor
          venue={selected === 'new' ? null : selected}
          onClose={() => setSelected(null)}
          onDone={reload}
        />
      )}
    </>
  );
}
function VenueEditor({
  venue,
  onClose,
  onDone,
}: {
  venue: Venue | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [key] = useState(crypto.randomUUID());
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setError(null);
    setBusy(true);
    try {
      await api(`/business/venues${venue ? `/${venue.id}` : ''}`, {
        method: venue ? 'PATCH' : 'POST',
        idempotencyKey: key,
        body: {
          venueName: String(f.get('venueName')),
          address: String(f.get('address')),
          city: String(f.get('city')),
          timeZone: 'Africa/Lagos',
          ...(venue ? { expectedRevision: venue.revision } : {}),
        },
      });
      showSuccess('The venue has been saved.');
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the venue.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={venue ? 'Edit this venue' : 'Add a venue'} onClose={onClose} busy={busy}>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Venue name">
          <input name="venueName" required maxLength={160} defaultValue={venue?.venueName} />
        </Field>
        <Field label="Street address">
          <input
            name="address"
            required
            minLength={4}
            maxLength={300}
            defaultValue={venue?.address}
          />
        </Field>
        <Field label="City">
          <input name="city" required maxLength={160} defaultValue={venue?.city} />
        </Field>
        <p className="small-copy">
          Launch venues use Africa/Lagos time. Each offering belongs to one venue.
        </p>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Go back
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save venue'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
