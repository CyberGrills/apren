import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSearchText, searchLocations } from './locationSearch.ts';

const places = [
  { name: 'Eket' },
  { name: 'Ikot Abasi' },
  { name: 'Ikot Ekpene' },
  { name: 'Ikot Uyo' },
  { name: 'Use Offot', area: 'Uyo' },
  { name: 'Uyo' },
  { name: 'Uyo Road' },
];

test('normalizeSearchText ignores case, accents and punctuation', () => {
  assert.equal(normalizeSearchText('  Ikot-EKPENE '), 'ikot ekpene');
  assert.equal(normalizeSearchText('\u1ECC\u0300y\u1ECD\u0301'), 'oyo');
});

test('an empty query returns the first places in their original order', () => {
  const names = searchLocations(places, '   ', 3).map((place) => place.name);
  assert.deepEqual(names, ['Eket', 'Ikot Abasi', 'Ikot Ekpene']);
});

test('exact matches rank before prefixes, word starts and area matches', () => {
  const names = searchLocations(places, 'uyo').map((place) => place.name);
  assert.deepEqual(names, ['Uyo', 'Uyo Road', 'Ikot Uyo', 'Use Offot']);
});

test('multi-word and punctuated queries match', () => {
  const names = searchLocations(places, 'ikot-ek').map((place) => place.name);
  assert.deepEqual(names, ['Ikot Ekpene']);
});

test('accented place names match plain-letter queries', () => {
  const accented = [{ name: '\u1ECC\u0300y\u1ECD\u0301' }, { name: 'Ibadan' }];
  const names = searchLocations(accented, 'oyo').map((place) => place.name);
  assert.deepEqual(names, ['\u1ECC\u0300y\u1ECD\u0301']);
});

test('results are capped, and no match gives an empty list', () => {
  const many = Array.from({ length: 200 }, (_, index) => ({ name: `Town ${index}` }));
  assert.equal(searchLocations(many, 'town', 50).length, 50);
  assert.deepEqual(searchLocations(places, 'zzz'), []);
});
