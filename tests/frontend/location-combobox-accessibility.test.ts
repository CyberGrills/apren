import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const combobox = readFileSync(
  new URL('../../frontend/src/components/LocationCombobox.tsx', import.meta.url),
  'utf8',
);
const fields = readFileSync(
  new URL('../../frontend/src/components/LocationFields.tsx', import.meta.url),
  'utf8',
);

test('combobox expansion reflects the visible loading and empty popup', () => {
  assert.match(combobox, /aria-expanded=\{popupVisible\}/);
  assert.match(combobox, /aria-controls=\{listVisible \? listId : undefined\}/);
  assert.match(combobox, /aria-busy=\{loading\}/);
});

test('state and city fields render only remote suggestions for the active query', () => {
  assert.match(fields, /resultsForActiveQuery\(remoteResult, city, remoteLoading\)/);
});
