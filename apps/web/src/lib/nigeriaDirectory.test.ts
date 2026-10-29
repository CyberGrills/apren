import assert from 'node:assert/strict';
import test from 'node:test';
import {
  directoryListingMatchKey,
  listingsForKind,
  nigeriaStateDirectories,
  sourcedDirectoryListings,
} from './nigeriaDirectory.ts';

test('the state index covers 36 states and the Federal Capital Territory in alphabetical order', () => {
  assert.equal(nigeriaStateDirectories.length, 37);
  assert.equal(new Set(nigeriaStateDirectories.map((entry) => entry.stateName)).size, 37);
  assert.deepEqual(
    nigeriaStateDirectories.map((entry) => entry.stateName),
    [...nigeriaStateDirectories.map((entry) => entry.stateName)].sort((a, b) =>
      a.localeCompare(b, 'en-NG'),
    ),
  );
  for (const entry of nigeriaStateDirectories) {
    assert.ok(entry.capital);
    assert.match(entry.hotelDirectoryUrl, /^https:\/\//);
  }
});

test('directory records are source-backed and never marked bookable', () => {
  assert.ok(sourcedDirectoryListings.length >= 15);
  for (const entry of sourcedDirectoryListings) {
    assert.ok(entry.name);
    assert.ok(entry.city);
    assert.ok(entry.state);
    assert.match(entry.imageUrl, /^https:\/\//);
    assert.match(entry.imageSourceUrl, /^https:\/\//);
    assert.match(entry.sourceUrl, /^https:\/\//);
    assert.equal(entry.status, 'DIRECTORY_ONLY');
    assert.equal(entry.bookable, false);
  }
});

test('category filters only return the requested directory category, alphabetically sorted', () => {
  assert.equal(listingsForKind('STAY').length, 8);
  assert.equal(listingsForKind('DINING').length, 4);
  assert.equal(listingsForKind('EXPERIENCE').length, 8);
  for (const kind of ['STAY', 'DINING', 'EXPERIENCE'] as const) {
    const entries = listingsForKind(kind);
    assert.ok(entries.every((entry) => entry.kind === kind));
    assert.deepEqual(
      entries.map((entry) => [entry.state, entry.city, entry.name]),
      [...entries]
        .sort(
          (a, b) =>
            a.state.localeCompare(b.state, 'en-NG') ||
            a.city.localeCompare(b.city, 'en-NG') ||
            a.name.localeCompare(b.name, 'en-NG'),
        )
        .map((entry) => [entry.state, entry.city, entry.name]),
    );
  }
});


test('Kiniz Apartments & Hotel is searchable as a sourced Uyo directory lead, not live inventory', () => {
  const kiniz = listingsForKind('STAY').find((entry) => entry.id === 'stay-kiniz-apartments-hotel-uyo');
  assert.ok(kiniz);
  assert.equal(kiniz.name, 'Kiniz Apartments & Hotel');
  assert.equal(kiniz.city, 'Uyo');
  assert.equal(kiniz.state, 'Akwa Ibom');
  assert.match(kiniz.sourceUrl, /^https:\/\/www\.hotels\.com\//);
  assert.equal(kiniz.status, 'DIRECTORY_ONLY');
  assert.equal(kiniz.bookable, false);
});


test('Kiniz directory lead exposes source-linked rate references and booking channels without enabling 7even checkout', () => {
  const kiniz = listingsForKind('STAY').find((entry) => entry.id === 'stay-kiniz-apartments-hotel-uyo');
  assert.ok(kiniz);
  assert.equal(kiniz.bookable, false);
  assert.equal(kiniz.status, 'DIRECTORY_ONLY');
  assert.match(kiniz.officialBookingUrl ?? '', /^https:\/\/kinizapartments\.ng\//);
  assert.equal(kiniz.externalListings?.some((source) => source.url.includes('airbnb.com/rooms/1748812631839796794')), true);
  assert.equal(kiniz.publishedRateNotes?.some((note) => note.source === 'Kiniz official website'), true);
  assert.equal(kiniz.publishedRateNotes?.some((note) => note.source === 'Hotels.ng'), true);
  assert.equal(kiniz.publishedRateNotes?.some((note) => note.source === 'BookDirect.ng'), true);
});


test('directory matching is stable across numeric database IDs and curated slug IDs', () => {
  const curated = listingsForKind('DINING')[0];
  assert.ok(curated);
  const live = { ...curated, id: '42' };
  assert.notEqual(live.id, curated.id);
  assert.equal(directoryListingMatchKey(live), directoryListingMatchKey(curated));
});

test('directory matching distinguishes different cities, states, and categories', () => {
  const curated = listingsForKind('DINING')[0];
  assert.ok(curated);
  assert.notEqual(directoryListingMatchKey(curated), directoryListingMatchKey({ ...curated, city: 'Different City' }));
  assert.notEqual(directoryListingMatchKey(curated), directoryListingMatchKey({ ...curated, state: 'Different State' }));
  assert.notEqual(directoryListingMatchKey(curated), directoryListingMatchKey({ ...curated, kind: 'EXPERIENCE' }));
});
