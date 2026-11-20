import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../../frontend/src/pages/public/HomePage.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../../frontend/src/pages/public/ChristmasUnpluggedPage.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../frontend/src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../frontend/src/styles/christmas-unplugged.css', import.meta.url), 'utf8');

test('Christmas Unplugged is discoverable from the 7EVEN homepage and has a dedicated route', () => {
  assert.match(home, /Christmas, unplugged/);
  assert.match(home, /\/experiences\/christmas-unplugged/);
  assert.match(app, /path="\/experiences\/christmas-unplugged"/);
});

test('festival details link to the organiser and avoid implying a 7EVEN partnership', () => {
  assert.match(page, /ibomfest\.akwaibomstate\.gov\.ng/);
  assert.match(page, /does not imply an official partnership/);
  assert.match(page, /30 November 2026 – 1 January 2027/);
  assert.match(page, /Unity Park, Uyo, Akwa Ibom/);
});

test('only published flagship highlights are featured and booking claims remain supply-gated', () => {
  for (const date of ['30 NOV', '06 DEC', '18 DEC', '20 DEC', '31 DEC']) assert.ok(page.includes(date));
  assert.match(page, /Availability, prices and booking status are shown only when supplied and confirmed/);
  assert.match(page, /See official programme/);
});

test('festival feature has responsive layouts and uses existing 7EVEN design tokens', () => {
  assert.match(css, /@media\(max-width:800px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /var\(--brand-primary\)/);
  assert.match(css, /var\(--accent\)/);
});
