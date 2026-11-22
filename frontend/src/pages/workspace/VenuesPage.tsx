import { useFeedback } from '../../components/Feedback.tsx';
import type { Venue } from '@7even/contracts';
import { Plus, Wrench } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorNotice, Field, Loading, Modal, PageHeader } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';

type AmenityStatus = 'ACTIVE' | 'INACTIVE' | 'SEASONAL' | 'CLOSED';
type Amenity = {
  id: string;
  venueId: string;
  category: string;
  name: string;
  description: string;
  status: AmenityStatus;
  accessType: 'INCLUDED' | 'PAID';
  bookingRequired: boolean;
  openingHours: Record<string, string>;
  guestNotes: string;
  sortOrder: number;
  revision: number;
};
const amenityCategories = [
  ['POOL', 'Pool / poolside'], ['GYM', 'Gym / fitness room'], ['SPA', 'Spa'], ['STORE', 'Store'],
  ['SALON', 'Salon'], ['RESTAURANT', 'Restaurant'], ['BAR', 'Bar / lounge'],
  ['CONFERENCE', 'Conference room'], ['PARKING', 'Parking'], ['SHUTTLE', 'Shuttle'], ['OTHER', 'Other'],
] as const;

export function VenuesPage() {
  const { data, loading, error, reload } = useApi<Venue[]>('/business/venues');
  const [selected, setSelected] = useState<Venue | 'new' | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Venue | null>(null);
  const [amenityVenue, setAmenityVenue] = useState<Venue | null>(null);
  return (
    <>
      <PageHeader
        eyebrow="Your business"
        title="A place for every guest."
        description="Manage your property locations and the facilities guests can expect at each venue."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setSelected('new')}>
            <Plus size={16} /> Add a venue
          </button>
        }
      />
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {data?.length === 0 && !loading && !error && (
        <EmptyState title="Add your first venue." description="Create the physical location where guests stay, dine or enjoy an experience. You can manage its amenities after saving." />
      )}
      <div className="work-offering-grid">
        {data?.map((venue) => (
          <article className="panel" key={venue.id}>
            <p className="eyebrow">{venue.city}</p>
            <h2>{venue.venueName}</h2>
            <p>{venue.address}</p>
            <p className="small-copy">Local time: {venue.timeZone === 'Africa/Lagos' ? 'West Africa Time (WAT)' : venue.timeZone}</p>
            <div className="work-offering-actions">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setSelected(venue)}>Edit venue</button>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setAmenityVenue(venue)}>
                <Wrench size={15} /> Manage amenities
              </button>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setArchiveTarget(venue)}>Archive</button>
            </div>
          </article>
        ))}
      </div>
      {selected && <VenueEditor venue={selected === 'new' ? null : selected} onClose={() => setSelected(null)} onDone={reload} />}
      {archiveTarget && <VenueArchiveDialog venue={archiveTarget} onClose={() => setArchiveTarget(null)} onDone={reload} />}
      {amenityVenue && <VenueAmenitiesManager venue={amenityVenue} onClose={() => setAmenityVenue(null)} />}
    </>
  );
}

function VenueAmenitiesManager({ venue, onClose }: { venue: Venue; onClose: () => void }) {
  const { data, loading, error, reload } = useApi<Amenity[]>(`/business/venues/${venue.id}/amenities`);
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const { showSuccess } = useFeedback();
  async function deactivate(item: Amenity) {
    setBusyId(item.id);
    setActionError('');
    try {
      await api(`/business/venues/${venue.id}/amenities/${item.id}`, {
        method: 'DELETE',
        idempotencyKey: crypto.randomUUID(),
        body: { expectedRevision: item.revision },
      });
      showSuccess('Amenity moved to inactive. It is no longer shown to guests.');
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this amenity.');
    } finally {
      setBusyId(null);
    }
  }
  return (
    <Modal title={`Amenities · ${venue.venueName}`} onClose={onClose}>
      <div className="form-stack">
        <p className="small-copy">Only facilities confirmed by your business should be marked active. Paid services need a separate priced offering before guests can purchase them.</p>
        {loading && <Loading inline />}
        {error && <ErrorNotice message={error} retry={reload} />}
        {actionError && <ErrorNotice message={actionError} />}
        {data?.length === 0 && !loading && <EmptyState title="No amenities added yet." description="Add facilities such as a pool, gym, spa, store or salon." />}
        <div className="form-stack">
          {data?.map((item) => (
            <article className="panel" key={item.id}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{amenityCategories.find(([value]) => value === item.category)?.[1] ?? item.category}</p>
                  <h3>{item.name}</h3>
                </div>
                <span className={`status status-${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span>
              </div>
              {item.description && <p>{item.description}</p>}
              <p className="small-copy">{item.accessType === 'INCLUDED' ? 'Included for eligible guests' : 'Paid service'} · {item.bookingRequired ? 'Booking required' : 'No booking requirement recorded'}</p>
              {item.openingHours.schedule && <p className="small-copy">Hours: {item.openingHours.schedule}</p>}
              {item.guestNotes && <p className="small-copy">{item.guestNotes}</p>}
              <div className="work-offering-actions">
                <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditing(item)}>Edit</button>
                {item.status !== 'INACTIVE' && <button type="button" className="btn btn-secondary btn-small" disabled={busyId === item.id} onClick={() => void deactivate(item)}>{busyId === item.id ? 'Updating…' : 'Deactivate'}</button>}
              </div>
            </article>
          ))}
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Add amenity</button>
        </div>
      </div>
      {(creating || editing) && <AmenityEditor venue={venue} amenity={editing} onClose={() => { setCreating(false); setEditing(null); }} onDone={() => { reload(); setCreating(false); setEditing(null); }} />}
    </Modal>
  );
}

function AmenityEditor({ venue, amenity, onClose, onDone }: {
  venue: Venue; amenity: Amenity | null; onClose: () => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { showSuccess } = useFeedback();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const hours = String(form.get('hours') ?? '').trim();
    const body = {
      category: String(form.get('category')),
      name: String(form.get('name')),
      description: String(form.get('description') ?? ''),
      status: String(form.get('status')) as AmenityStatus,
      accessType: String(form.get('accessType')),
      bookingRequired: form.get('bookingRequired') === 'on',
      openingHours: hours ? { schedule: hours } : {},
      guestNotes: String(form.get('guestNotes') ?? ''),
      sortOrder: Number(form.get('sortOrder') ?? 0),
      ...(amenity ? { expectedRevision: amenity.revision } : {}),
    };
    setBusy(true);
    setError('');
    try {
      await api(`/business/venues/${venue.id}/amenities${amenity ? `/${amenity.id}` : ''}`, {
        method: amenity ? 'PATCH' : 'POST',
        idempotencyKey: crypto.randomUUID(),
        body,
      });
      showSuccess(amenity ? 'Amenity updated.' : 'Amenity added.');
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this amenity.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={amenity ? 'Edit amenity' : 'Add a venue amenity'} onClose={onClose} busy={busy}>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <Field label="Facility type">
          <select name="category" defaultValue={amenity?.category ?? 'POOL'}>
            {amenityCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Name"><input name="name" required minLength={2} maxLength={120} defaultValue={amenity?.name} placeholder="e.g. Rooftop swimming pool" /></Field>
        <Field label="Description"><textarea name="description" maxLength={1200} rows={2} defaultValue={amenity?.description} placeholder="Describe the facility and what guests can expect." /></Field>
        <Field label="Guest access">
          <select name="accessType" defaultValue={amenity?.accessType ?? 'INCLUDED'}>
            <option value="INCLUDED">Included for eligible guests</option>
            <option value="PAID">Paid separately</option>
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={amenity?.status ?? 'ACTIVE'}>
            <option value="ACTIVE">Active</option><option value="SEASONAL">Seasonal</option><option value="CLOSED">Temporarily closed</option><option value="INACTIVE">Inactive</option>
          </select>
        </Field>
        <Field label="Opening hours"><input name="hours" maxLength={80} defaultValue={amenity?.openingHours.schedule ?? ''} placeholder="e.g. Monday–Sunday, 8am–8pm" /></Field>
        <Field label="Guest notes"><textarea name="guestNotes" maxLength={1200} rows={2} defaultValue={amenity?.guestNotes} placeholder="Access rules, age limits or other confirmed details." /></Field>
        <Field label="Display order"><input name="sortOrder" type="number" min="0" max="10000" defaultValue={amenity?.sortOrder ?? 0} /></Field>
        <label className="field-checkbox"><input name="bookingRequired" type="checkbox" defaultChecked={amenity?.bookingRequired ?? false} /> Guests must arrange access in advance</label>
        <p className="small-copy">A paid facility is not purchasable until a separate priced offering and availability are configured.</p>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save amenity'}</button>
        </div>
      </form>
    </Modal>
  );
}

function VenueEditor({ venue, onClose, onDone }: { venue: Venue | null; onClose: () => void; onDone: () => void; }) {
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
        method: venue ? 'PATCH' : 'POST', idempotencyKey: key,
        body: { venueName: String(f.get('venueName')), address: String(f.get('address')), city: String(f.get('city')), timeZone: 'Africa/Lagos', ...(venue ? { expectedRevision: venue.revision } : {}) },
      });
      showSuccess('The venue has been saved.'); onDone(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the venue.'); }
    finally { setBusy(false); }
  }
  return (
    <Modal title={venue ? 'Edit this venue' : 'Add a venue'} onClose={onClose} busy={busy}>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Venue name"><input name="venueName" required maxLength={160} defaultValue={venue?.venueName} /></Field>
        <Field label="Street address"><input name="address" required minLength={4} maxLength={300} defaultValue={venue?.address} /></Field>
        <Field label="City"><input name="city" required maxLength={160} defaultValue={venue?.city} /></Field>
        <p className="small-copy">Launch venues use Africa/Lagos time. Each offering belongs to one venue.</p>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Go back</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save venue'}</button>
        </div>
      </form>
    </Modal>
  );
}

function VenueArchiveDialog({ venue, onClose, onDone }: { venue: Venue; onClose: () => void; onDone: () => void; }) {
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function archive() {
    setBusy(true); setError(null);
    try {
      await api(`/business/venues/${venue.id}`, { method: 'DELETE', idempotencyKey: crypto.randomUUID() });
      showSuccess('The unused venue has been archived.'); onDone(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not archive this venue.'); }
    finally { setBusy(false); }
  }
  return (
    <Modal title="Archive this venue?" onClose={onClose} busy={busy}>
      <div className="form-stack">
        <p>{venue.venueName} will no longer be available for new listings. Venues linked to existing places cannot be archived.</p>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Keep venue</button>
          <button type="button" className="btn btn-primary" onClick={() => void archive()} disabled={busy}>{busy ? 'Archiving…' : 'Archive venue'}</button>
        </div>
      </div>
    </Modal>
  );
}
