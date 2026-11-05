import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {
  getOfflineListings,
  getTripDrafts,
  removeOfflineListing,
  removeTripDraft,
  saveOfflineListing,
  saveTripDraft,
} from './offlineStore.ts';
import type { DirectoryListing } from './nigeriaDirectory.ts';

const listing: DirectoryListing = {
  id: 'offline-test-uyo-stay',
  kind: 'STAY',
  name: 'Test directory reference',
  state: 'Akwa Ibom',
  city: 'Uyo',
  area: 'Test area',
  address: 'Test address, Uyo',
  description: 'A source-backed directory reference used only in this test.',
  imageUrl: 'https://example.com/hotel.jpg',
  imageSourceName: 'Test source',
  imageSourceUrl: 'https://example.com/photo',
  sourceName: 'Test source',
  sourceUrl: 'https://example.com/listing',
  status: 'DIRECTORY_ONLY',
  bookable: false,
};

test('saved directory references persist and can be removed', async () => {
  const saved = await saveOfflineListing(listing);
  assert.equal(saved.id, listing.id);
  assert.equal(saved.name, listing.name);
  assert.equal(saved.city, 'Uyo');
  assert.ok(saved.savedAt);
  assert.ok(saved.lastUpdatedAt);

  const all = await getOfflineListings();
  assert.equal(all.some((item) => item.id === listing.id), true);

  await removeOfflineListing(listing.id);
  assert.equal((await getOfflineListings()).some((item) => item.id === listing.id), false);
});

test('trip plans are stored locally with an explicit non-booking status', async () => {
  const draft = await saveTripDraft({
    listingId: listing.id,
    listingName: listing.name,
    destination: 'Uyo, Akwa Ibom',
    checkIn: '2026-12-01',
    checkOut: '2026-12-03',
    guests: 2,
    notes: 'Arrive in the afternoon.',
  });

  assert.equal(draft.status, 'saved_on_device');
  assert.equal(draft.guests, 2);
  assert.equal((await getTripDrafts()).some((item) => item.id === draft.id), true);

  await removeTripDraft(draft.id);
  assert.equal((await getTripDrafts()).some((item) => item.id === draft.id), false);
});
