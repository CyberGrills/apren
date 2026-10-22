import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
  assert.equal(listingsForKind('STAY').length, 7);
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
