import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const home = readFileSync(
  new URL('../../frontend/src/pages/public/HomePage.tsx', import.meta.url),
  'utf8',
);
const sources = readFileSync(
  new URL('../../frontend/public/media/SOURCES.txt', import.meta.url),
  'utf8',
);

test('homepage does not imply that bookable hotel supply is already available', () => {
  assert.match(home, /Plan stays, dining and experiences across Nigeria, beginning in Uyo\./);
  assert.match(home, /A stay is shown as bookable only after the partner confirms its details and availability\./);
  assert.doesNotMatch(home, /Find verified stays, tables worth booking/);
});

test('Pidgin homepage copy follows the same verified-supply rule', () => {
  assert.match(home, /Plan places to stay, food and experiences for Nigeria, starting from Uyo\./);
  assert.match(home, /Stay go show as bookable only after partner confirm the details and availability\./);
  assert.doesNotMatch(home, /Find verified places to stay/);
});

test('āprən revenue capability is described as a designed capability, not an already live result', () => {
  assert.match(
    home,
    /a hospitality demand intelligence engine designed to help businesses understand demand and make better availability decisions/,
  );
  assert.match(home, /Tools being developed to help businesses understand demand/);
  assert.doesNotMatch(home, /It helps businesses read demand/);
});

test('Pidgin copy does not imply that live demand optimization is already operating', () => {
  assert.match(home, /Tools wey dey develop to help businesses understand demand/);
  assert.match(
    home,
    /a hospitality demand intelligence engine wey dey designed to help businesses understand demand and make better availability decisions/,
  );
  assert.doesNotMatch(home, /e dey help business read demand/);
});

test('green editorial image alt text and source register describe the forest-path asset consistently', () => {
  assert.match(home, /alt: 'A green forest path\. Illustrative stock photograph\.'/);
  assert.match(sources, /6\. Kate Gundareva, Unsplash\.\nA green forest path with trees and foliage\./);
  assert.doesNotMatch(sources, /<Describe exactly what the photo page shows\./);
});
