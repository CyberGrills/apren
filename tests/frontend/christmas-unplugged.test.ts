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

test('the complete organiser-published 31-LGA showcase is included with searchable dishes', () => {
  assert.match(page, /const lgaShowcases = \[/);
  assert.match(page, /Explore all 31 local stories/);
  assert.match(page, /Search an LGA or local dish/);
  assert.match(page, /filteredLgas/);
  assert.match(page, /const \[lgaSearch, setLgaSearch\] = useState\(''\)/);
  assert.equal((page.match(/\{ name: '/g) || []).length, 31, 'Expected exactly 31 LGA entries');
  assert.match(page, /Fri 1 Jan 2027/);
  const lgaNames = [
    'Ika', 'Uyo', 'Ikot Ekpene', 'Nsit Ibom', 'Oron', 'ONNA', 'Ini',
    'Ibesikpo Asutan', 'Eastern Obolo', 'Mbo', 'Nsit Atai', 'Ikono',
    'Essien Udim', 'Ibiono Ibom', 'Mkpat Enin', 'Ikot Abasi', 'Nsit Ubium',
    'Uruan', 'Oruk Anam', 'Obot Akara', 'Ukanafun', 'Etinan', 'Esit Eket',
    'Udung Uko', 'Abak', 'Ibeno', 'Urue-Offong/Oruko', 'Itu', 'Etim Ekpo',
    'Okobo', 'Eket',
  ];
  for (const name of lgaNames) assert.ok(page.includes(`name: '${name}'`) || page.includes(`name: "${name}"`), `Missing LGA: ${name}`);
  assert.match(page, /ibomfest\.akwaibomstate\.gov\.ng\/lgas/);
});

test('the 31-LGA directory has mobile layouts and accessible search feedback', () => {
  assert.match(css, /\.christmas-lga-grid/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /role="status"/);
});

test('official 4.0 artwork is displayed on the homepage and festival detail page with source attribution', () => {
  const artwork = 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/111485d1-e94f-48d5-b3b9-48dc9503935e/ibom-christmas-logo.png';
  assert.ok(home.includes(artwork), 'Homepage should use the official 4.0 artwork');
  assert.ok(page.includes(artwork), 'Festival detail page should use the official 4.0 artwork');
  assert.match(home, /Ibom Christmas Unplugged Media Centre/);
  assert.match(page, /Source: festival Media Centre/);
  assert.match(css, /\.christmas-home-artwork img/);
  assert.match(css, /\.christmas-hero-artwork img/);
});
