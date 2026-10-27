import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const publicShell = source('../../apps/web/src/pages/public/PublicShell.tsx');
const landing = source('../../apps/web/src/pages/public/LandingPage.tsx');
const explore = source('../../apps/web/src/pages/public/ExplorePage.tsx');
const account = source('../../apps/web/src/pages/customer/AccountPage.tsx');
const app = source('../../apps/web/src/App.tsx');

test('public navigation presents hotel stays rather than dining or experiences', () => {
  assert.match(publicShell, /Hotels & stays/);
  assert.doesNotMatch(publicShell, /kind=DINING|kind=EXPERIENCE/);
  assert.doesNotMatch(landing, /label: 'Dining'|label: 'Experiences'/);
});

test('guest search always requests stay inventory, including AI interpreted searches', () => {
  assert.match(explore, /query\.set\('kind', 'STAY'\)/);
  assert.match(explore, /next\.set\('kind', 'STAY'\)/);
  assert.doesNotMatch(explore, /sourcedDirectoryListings|DirectoryListingCard/);
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
