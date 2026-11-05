import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CloudOff, Download, MapPin, RefreshCw, Trash2 } from 'lucide-react';
import { OfflineStatusBar, useConnectionStatus } from '../../components/OfflineExperience.tsx';
import {
  formatOfflineDate,
  getOfflineListings,
  getTripDrafts,
  removeOfflineListing,
  removeTripDraft,
  saveTripDraft,
  type OfflineTripDraft,
  type SavedOfflineListing,
} from '../../lib/offlineStore.ts';
import { PublicFooter, PublicHeader, localDateNow, addDays } from './PublicShell.tsx';
import '../../styles/offline.css';

export function OfflinePage() {
  const online = useConnectionStatus();
  const [listings, setListings] = useState<SavedOfflineListing[]>([]);
  const [drafts, setDrafts] = useState<OfflineTripDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedListing, setSelectedListing] = useState('');
  const [checkIn, setCheckIn] = useState(localDateNow());
  const [checkOut, setCheckOut] = useState(addDays(localDateNow(), 1));
  const [guests, setGuests] = useState(1);
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [savedListings, savedDrafts] = await Promise.all([getOfflineListings(), getTripDrafts()]);
      setListings(savedListings.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
      setDrafts(savedDrafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setSelectedListing((current) => current || savedListings[0]?.id || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this device’s offline space.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener('seven:offline-data-changed', refresh);
    return () => window.removeEventListener('seven:offline-data-changed', refresh);
  }, [refresh]);

  const selected = useMemo(() => listings.find((listing) => listing.id === selectedListing), [listings, selectedListing]);

  async function removeListing(id: string) {
    await removeOfflineListing(id);
    setFeedback('Removed from this device.');
  }

  async function removeDraft(id: string) {
    await removeTripDraft(id);
    setFeedback('Trip plan removed.');
  }

  async function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (checkOut <= checkIn) {
      setFeedback('Choose a check-out date after check-in.');
      return;
    }
    try {
      await saveTripDraft({
        listingId: selected.id,
        listingName: selected.name,
        destination: `${selected.city}, ${selected.state}`,
        checkIn,
        checkOut,
        guests,
        notes: notes.trim(),
      });
      setNotes('');
      setFeedback('Trip plan saved on this device. It is not a reservation.');
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Could not save this trip plan.');
    }
  }

  return (
    <div className="public-page seven-offline-page">
      <PublicHeader />
      <OfflineStatusBar />
      <main id="main-content" className="public-container seven-offline-main">
        <Link to="/explore?kind=STAY" className="seven-offline-back">← Explore 7even</Link>
        <header className="seven-offline-heading">
          <p className="public-eyebrow">7EVEN · YOUR OFFLINE SPACE</p>
          <h1>Your plans, even without data.</h1>
          <p>Keep selected discovery information on this device, prepare a trip plan, and pick up where you left off when you reconnect.</p>
          <div className={online ? 'seven-offline-connection is-online' : 'seven-offline-connection is-offline'}>
            {online ? <RefreshCw size={17} aria-hidden="true" /> : <CloudOff size={17} aria-hidden="true" />}
            <span>{online ? 'Connected · Your saved information is available offline too.' : 'No internet connection · Your saved information remains available.'}</span>
          </div>
        </header>

        {error && <div className="seven-offline-error" role="alert">{error}<button type="button" onClick={() => void refresh()}>Try again</button></div>}
        {feedback && <p className="seven-offline-feedback" role="status">{feedback}</p>}

        <section className="seven-offline-section" aria-labelledby="saved-title">
          <div className="seven-offline-section-heading">
            <div><p className="public-eyebrow">Available on this device</p><h2 id="saved-title">Saved places</h2></div>
            <span>{listings.length} saved</span>
          </div>
          {loading ? <p role="status">Opening your offline space…</p> : listings.length ? (
            <div className="seven-offline-list">
              {listings.map((listing) => (
                <article className="seven-offline-place" key={listing.id}>
                  {listing.imageUrl ? <img src={listing.imageUrl} alt="" loading="lazy" /> : <div className="seven-offline-image-placeholder"><Download size={20} /></div>}
                  <div className="seven-offline-place-copy">
                    <span className="seven-offline-kind">{listing.kind === 'STAY' ? 'Stay · Directory reference' : listing.kind === 'DINING' ? 'Dining · Directory reference' : 'Experience · Directory reference'}</span>
                    <h3>{listing.name}</h3>
                    <p><MapPin size={14} aria-hidden="true" /> {listing.city}, {listing.state}</p>
                    <small>Saved {formatOfflineDate(listing.savedAt)} · Details refreshed {formatOfflineDate(listing.lastUpdatedAt)}</small>
                    <a href={listing.sourceUrl} target="_blank" rel="noreferrer noopener">Source: {listing.sourceName}</a>
                  </div>
                  <button type="button" className="seven-offline-icon-button" onClick={() => void removeListing(listing.id)} aria-label={`Remove ${listing.name} from offline space`}><Trash2 size={17} /></button>
                </article>
              ))}
            </div>
          ) : (
            <div className="seven-offline-empty">
              <Download size={25} aria-hidden="true" />
              <h3>No saved places yet</h3>
              <p>Save a place while you’re online. Its details will then be available here without mobile data.</p>
              <Link className="btn btn-primary" to="/directory?kind=STAY">Explore places</Link>
            </div>
          )}
        </section>

        <section className="seven-offline-section" aria-labelledby="trip-plan-title">
          <div className="seven-offline-section-heading">
            <div><p className="public-eyebrow">Prepared offline</p><h2 id="trip-plan-title">Trip plan drafts</h2></div>
            <span>{drafts.length} on this device</span>
          </div>
          {listings.length ? (
            <form className="seven-offline-draft-form" onSubmit={(event) => void createDraft(event)}>
              <p>Prepare your travel details now. This saves a personal trip plan only; it does not contact a hotel or create a reservation.</p>
              <label>Saved place
                <select value={selectedListing} onChange={(event) => setSelectedListing(event.target.value)} required>
                  {listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.name} · {listing.city}</option>)}
                </select>
              </label>
              <div className="seven-offline-form-grid">
                <label>Check-in
                  <input type="date" value={checkIn} min={localDateNow()} onChange={(event) => { setCheckIn(event.target.value); if (checkOut <= event.target.value) setCheckOut(addDays(event.target.value, 1)); }} required />
                </label>
                <label>Check-out
                  <input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(event) => setCheckOut(event.target.value)} required />
                </label>
                <label>Guests
                  <select value={guests} onChange={(event) => setGuests(Number(event.target.value))}>{[1,2,3,4,5,6,7,8].map((count) => <option value={count} key={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>)}</select>
                </label>
              </div>
              <label>Notes (optional)
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={3} placeholder="Anything you want to remember about this trip…" />
              </label>
              <button type="submit" className="btn btn-primary"><CalendarDays size={17} aria-hidden="true" /> Save trip plan on this device</button>
            </form>
          ) : <p className="seven-offline-note">Save a place first to prepare a trip plan.</p>}
          {drafts.length > 0 && (
            <div className="seven-offline-drafts">
              {drafts.map((draft) => (
                <article className="seven-offline-draft" key={draft.id}>
                  <div><strong>{draft.listingName}</strong><span>{draft.destination}</span><small>{draft.checkIn} – {draft.checkOut} · {draft.guests} {draft.guests === 1 ? 'guest' : 'guests'}</small>{draft.notes && <p>{draft.notes}</p>}<em>Saved on this device · Not a reservation</em></div>
                  <button type="button" className="seven-offline-icon-button" onClick={() => void removeDraft(draft.id)} aria-label={`Delete trip plan for ${draft.listingName}`}><Trash2 size={17} /></button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="seven-offline-boundary" aria-labelledby="offline-boundary-title">
          <h2 id="offline-boundary-title">What still needs a connection?</h2>
          <p>Live availability, current prices, hotel acceptance, account records and payment confirmation must be checked with 7even’s services. A saved directory reference or trip plan is never a confirmed booking.</p>
          <p>Booking records and secure cross-device synchronisation will be connected when the backend team provides the approved offline-sync contract.</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
