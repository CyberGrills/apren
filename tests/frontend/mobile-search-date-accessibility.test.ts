import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const locationFields = readFileSync(
  new URL('../../frontend/src/components/LocationFields.tsx', import.meta.url),
  'utf8',
);
const locationStyles = readFileSync(
  new URL('../../frontend/src/styles/location-fields.css', import.meta.url),
  'utf8',
);
const datePickerStyles = readFileSync(
  new URL('../../frontend/src/styles/date-picker.css', import.meta.url),
  'utf8',
);

test('destination autocomplete exposes a valid combobox and live status relationship', () => {
  assert.match(locationFields, /role="combobox"/);
  assert.match(locationFields, /aria-autocomplete="list"/);
  assert.match(locationFields, /aria-controls=\{open \? \`\$\{id\}-options\` : undefined\}/);
  assert.match(locationFields, /aria-describedby=\{open \? \`\$\{id\}-status\` : undefined\}/);
  assert.match(locationFields, /role="listbox"/);
  assert.match(locationFields, /role="option"/);
  assert.match(locationFields, /id=\{\`\$\{id\}-status\`\} role="status" aria-live="polite"/);
});

test('destination listbox options use active-descendant rather than stray tab stops', () => {
  assert.match(locationFields, /aria-activedescendant=\{open && active >= 0 \? \`\$\{id\}-\$\{active\}\` : undefined\}/);
  const option = locationFields.slice(locationFields.indexOf('role="option"') - 180, locationFields.indexOf('role="option"') + 180);
  assert.doesNotMatch(option, /tabIndex=/);
});

test('mobile destination suggestions stay within the viewport and remain independently scrollable', () => {
  assert.match(locationStyles, /max-height:\s*min\(70dvh, 32rem\)/);
  assert.match(locationStyles, /overscroll-behavior:\s*contain/);
  assert.match(locationStyles, /@media \(max-width: 600px\)[\s\S]*?width: min\(390px, calc\(100vw - 2rem\)\)/);
});

test('calendar dialog respects mobile safe areas and contains internal scroll', () => {
  assert.match(datePickerStyles, /max-height:\s*calc\(100dvh - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\) - 1rem\)/);
  assert.match(datePickerStyles, /overscroll-behavior:\s*contain/);
});
