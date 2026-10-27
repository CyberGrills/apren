import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const publicShell = source('../../apps/web/src/pages/public/PublicShell.tsx');
const landing = source('../../apps/web/src/pages/public/LandingPage.tsx');
const explore = source('../../apps/web/src/pages/public/ExplorePage.tsx');
const publicStyles = source('../../apps/web/src/styles/public.css');
const account = source('../../apps/web/src/pages/customer/AccountPage.tsx');
const app = source('../../apps/web/src/App.tsx');

test('public navigation retains stays, dining and experiences', () => {
  assert.match(publicShell, /Hotels & stays/);
  assert.match(publicShell, /kind=DINING/);
  assert.match(publicShell, /kind=EXPERIENCE/);
  assert.match(landing, /label: 'Dining'/);
  assert.match(landing, /label: 'Things to do'/);
});

test('explore preserves the selected sector while stay-only search uses AI filters', () => {
  assert.match(explore, /query\.set\('kind', kind\)/);
  assert.match(explore, /next\.set\('kind', kind\)/);
  assert.match(explore, /const isStaySearch = kind === 'STAY'/);
  assert.doesNotMatch(explore, /sourcedDirectoryListings|DirectoryListingCard/);
});


test('Explore redesign keeps all three categories and mobile filters in normal document flow', () => {
  assert.match(explore, /aria-label="Explore categories"/);
  assert.match(explore, /label: 'Hotels & stays'/);
  assert.match(explore, /label: 'Dining'/);
  assert.match(explore, /label: 'Things to do'/);
  assert.match(explore, /aria-controls="explore-filter-form"/);
  assert.match(explore, /filtersOpen \? 'is-open' : ''/);
  assert.match(publicStyles, /\.explore-filters\.is-open\s*\{\s*display:\s*grid;/);
  assert.match(publicStyles, /@media \(max-width: 640px\)/);
});

test('external directory and legacy rewards routes do not act as booking destinations', () => {
  assert.match(app, /path="\/directory" element={<Navigate to="\/explore\?kind=STAY" replace \/>}/);
  assert.match(app, /path="\/app\/points" element={<Navigate to="\/app\/bookings" replace \/>}/);
  assert.match(app, /path="\/app\/benefits" element={<Navigate to="\/app\/bookings" replace \/>}/);
  assert.match(app, /path="\/app\/exchange" element={<Navigate to="\/app\/bookings" replace \/>}/);
});

test('guest account navigation stays focused on profile, bookings and updates', () => {
  assert.match(account, /\['profile', 'Profile'\]/);
  assert.match(account, /\['bookings', 'Bookings'\]/);
  assert.match(account, /\['activity', 'Updates'\]/);
  assert.doesNotMatch(account, /\['points', 'Points'\]|\['benefits', 'Benefits'\]|\['exchange', 'Exchange'\]/);
});
