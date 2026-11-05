import type { DirectoryListing } from './nigeriaDirectory.ts';

const DATABASE_NAME = 'seven-offline';
const DATABASE_VERSION = 1;
const LISTINGS_STORE = 'saved-listings';
const DRAFTS_STORE = 'trip-drafts';

export interface SavedOfflineListing {
  id: string;
  kind: DirectoryListing['kind'];
  name: string;
  state: string;
  city: string;
  area: string;
  address: string;
  description: string;
  imageUrl: string;
  sourceUrl: string;
  sourceName: string;
  savedAt: string;
  lastUpdatedAt: string;
}

export interface OfflineTripDraft {
  id: string;
  listingId: string;
  listingName: string;
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  notes: string;
  status: 'saved_on_device';
  createdAt: string;
  updatedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Offline storage is not available in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LISTINGS_STORE)) {
        database.createObjectStore(LISTINGS_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(DRAFTS_STORE)) {
        database.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open offline storage.'));
    request.onblocked = () => reject(new Error('Offline storage is busy in another 7even tab. Close the other tab and try again.'));
  });
}

function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline storage request failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Offline storage transaction was interrupted.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error('Offline storage transaction failed.'));
  }));
}

export async function saveOfflineListing(listing: DirectoryListing): Promise<SavedOfflineListing> {
  const now = new Date().toISOString();
  const existing = await getOfflineListing(listing.id);
  const saved: SavedOfflineListing = {
    id: listing.id,
    kind: listing.kind,
    name: listing.name,
    state: listing.state,
    city: listing.city,
    area: listing.area,
    address: listing.address,
    description: listing.description,
    imageUrl: listing.imageUrl,
    sourceUrl: listing.sourceUrl,
    sourceName: listing.sourceName,
    savedAt: existing?.savedAt ?? now,
    lastUpdatedAt: now,
  };
  await transact<IDBValidKey>(LISTINGS_STORE, 'readwrite', (store) => store.put(saved));
  window.dispatchEvent(new Event('seven:offline-data-changed'));
  return saved;
}

export function getOfflineListing(id: string): Promise<SavedOfflineListing | undefined> {
  return transact<SavedOfflineListing | undefined>(LISTINGS_STORE, 'readonly', (store) => store.get(id));
}

export function getOfflineListings(): Promise<SavedOfflineListing[]> {
  return transact<SavedOfflineListing[]>(LISTINGS_STORE, 'readonly', (store) => store.getAll());
}

export async function removeOfflineListing(id: string): Promise<void> {
  await transact<undefined>(LISTINGS_STORE, 'readwrite', (store) => store.delete(id));
  window.dispatchEvent(new Event('seven:offline-data-changed'));
}

export async function saveTripDraft(
  input: Omit<OfflineTripDraft, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
): Promise<OfflineTripDraft> {
  const now = new Date().toISOString();
  const draft: OfflineTripDraft = {
    ...input,
    id: globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: 'saved_on_device',
    createdAt: now,
    updatedAt: now,
  };
  await transact<IDBValidKey>(DRAFTS_STORE, 'readwrite', (store) => store.put(draft));
  window.dispatchEvent(new Event('seven:offline-data-changed'));
  return draft;
}

export function getTripDrafts(): Promise<OfflineTripDraft[]> {
  return transact<OfflineTripDraft[]>(DRAFTS_STORE, 'readonly', (store) => store.getAll());
}

export async function removeTripDraft(id: string): Promise<void> {
  await transact<undefined>(DRAFTS_STORE, 'readwrite', (store) => store.delete(id));
  window.dispatchEvent(new Event('seven:offline-data-changed'));
}

export function formatOfflineDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
