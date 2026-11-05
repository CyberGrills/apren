import { useEffect, useState } from 'react';
import { BookmarkCheck, Download } from 'lucide-react';
import { getOfflineListing, saveOfflineListing } from '../../lib/offlineStore.ts';
import type { DirectoryListing } from '../../lib/nigeriaDirectory.ts';

export function OfflineSaveButton({ listing }: { listing: DirectoryListing }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getOfflineListing(listing.id).then((value) => {
        if (active) setSaved(Boolean(value));
      }).catch(() => {
        if (active) setMessage('Offline storage is unavailable in this browser.');
      });
    };
    refresh();
    window.addEventListener('seven:offline-data-changed', refresh);
    return () => {
      active = false;
      window.removeEventListener('seven:offline-data-changed', refresh);
    };
  }, [listing.id]);

  async function toggleSaved() {
    setBusy(true);
    setMessage('');
    try {
      if (saved) {
        const { removeOfflineListing } = await import('../../lib/offlineStore.ts');
        await removeOfflineListing(listing.id);
        setSaved(false);
      } else {
        await saveOfflineListing(listing);
        setSaved(true);
        setMessage('Saved on this device. Open Offline space to view it without data.');
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save this place offline.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="seven-offline-save-wrap">
      <button type="button" className="seven-offline-save-button" onClick={() => void toggleSaved()} disabled={busy} aria-pressed={saved}>
        {saved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
        {busy ? 'Saving…' : saved ? 'Saved offline' : 'Save offline'}
      </button>
      {message && <span className="seven-offline-save-feedback" role="status">{message}</span>}
    </div>
  );
}
