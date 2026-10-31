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

test('sample offerings disable the booking and payment flow', () => {
  const bookingPanel = source('../../apps/web/src/pages/public/BookingPanel.tsx');
  assert.match(bookingPanel, /if \(offering\.isSample\)/);
  assert.match(bookingPanel, /Booking unavailable/);
  assert.match(bookingPanel, /not verified live inventory/);
  assert.match(bookingPanel, /Dates, room counts, quotes,[\s\S]*?payment are disabled/);
});


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

test('empty later explore pages offer a way back without discarding active filters', () => {
  assert.match(explore, /page > 1 \? \(/);
  assert.match(explore, /Previous results/);
  assert.match(explore, /const previous = new URLSearchParams\(params\)/);
  assert.match(explore, /previous\.set\('page', String\(page - 1\)\)/);
});


test('destination input label uses its generated unique input id', () => {
  const locations = source('../../apps/web/src/components/LocationFields.tsx');
  assert.match(locations, /const inputId = `\$\{id\}-input`/);
  assert.match(locations, /<label htmlFor=\{inputId\}>Where<\/label>/);
  assert.match(locations, /<input\s+id=\{inputId\}/);
  assert.doesNotMatch(locations, /id="seven-city"|htmlFor="seven-city"/);
});

test('Explore checkout minimum follows check-in and requires at least one night', () => {
  assert.match(explore, /min={startDate \? addCalendarDays\(startDate, 1\) : localDateNow\(\)}/);
  assert.match(explore, /if \(endDate && nextStart && endDate <= nextStart\) setEndDate\(''\)/);
  assert.match(explore, /value={endDate}[\s\S]*?onChange={\(event\) => setEndDate\(event.target.value\)}/);
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

test('hamburger navigation closes predictably and stays within the mobile viewport', () => {
  assert.match(publicShell, /aria-controls="public-mobile-nav"/);
  assert.match(publicShell, /aria-expanded={open}/);
  assert.match(publicShell, /event\.key === 'Escape'/);
  assert.match(publicShell, /closeOnOutsideClick/);
  assert.match(publicShell, /\[location\.pathname, location\.search\]/);
  assert.match(publicStyles, /\.public-mobile-nav\s*\{[\s\S]*?box-shadow/);
  assert.match(publicStyles, /@media \(max-width: 600px\)/);
  assert.match(publicStyles, /max-height: min\(70vh, 32rem\)/);
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

test('checkout shows service fees separately when the quote includes one', () => {
  const bookingPanel = source('../../apps/web/src/pages/public/BookingPanel.tsx');
  assert.match(bookingPanel, /quote\.price\.serviceMinor !== '0'/);
  assert.match(bookingPanel, /<dt>Service fee<\/dt>[\s\S]*?<Money minor={quote\.price\.serviceMinor} \/>/);
  assert.match(bookingPanel, /<dt>Total<\/dt>[\s\S]*?<Money minor={quote\.price\.totalMinor} \/>/);
});

test('sample offerings never present illustrative prices as bookable rates', () => {
  const ui = source('../../apps/web/src/components/ui.tsx');
  assert.match(ui, /offering\.isSample \? \([\s\S]*?Illustrative listing only\. This place is not available to book through 7even\./);
  assert.match(ui, /: \([\s\S]*?<Money minor={offering\.priceMinor} \/>/);
});


test('āprən × 7even watermark is global, decorative and does not intercept page interaction', () => {
  assert.match(app, /className="apren-watermark" aria-hidden="true"/);
  assert.match(app, /āprən × 7even/);
  assert.match(app, /Array\.from\(\{ length: 24 \}/);
  assert.match(source('../../apps/web/src/styles/global.css'), /\.apren-watermark\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(source('../../apps/web/src/styles/global.css'), /pointer-events:\s*none/);
});


test('failed city loading exposes one retry control instead of duplicate retry actions', () => {
  const locations = source('../../apps/web/src/components/LocationFields.tsx');
  assert.match(locations, /<ErrorNotice[\s\S]*?retry=\{\(\) => setAttempt\(\(value\) => value \+ 1\)\}/);
  assert.doesNotMatch(locations, /className="location-retry"|Reload cities/);
});


test('Google Maps proof of concept is lazy, key-gated, and does not fabricate property markers', () => {
  const mapScene = source('../../apps/web/src/components/GoogleMapsScene.tsx');
  assert.match(mapScene, /VITE_GOOGLE_MAPS_API_KEY/);
  assert.match(mapScene, /IntersectionObserver/);
  assert.match(mapScene, /Property pins will appear only when 7even has verified coordinates/);
  assert.match(mapScene, /does not request your location or change search, booking, or payment state/);
  assert.doesNotMatch(mapScene, /new google\.maps\.Marker/);
  assert.match(explore, /isStaySearch && <GoogleMapsScene \/>/);
});


test('virtual pilot scroll scene is stay-only, pinned, and respects reduced motion', () => {
  const pilot = source('../../apps/web/src/components/ScrollPilotScene.tsx');
  const styles = source('../../apps/web/src/components/scroll-pilot-scene.css');
  assert.match(explore, /isStaySearch && <ScrollPilotScene \/>/);
  assert.match(styles, /position: sticky/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.seven-pilot-avatar \{ animation: none !important; \}/);
  assert.match(pilot, /No booking action is triggered/);
  assert.match(pilot, /aria-hidden="true"/);
  assert.match(pilot, /className="seven-pilot-portrait"/);
  assert.match(pilot, /linearGradient id="pilot-skin"/);
  assert.match(pilot, /pattern id="pilot-coils"/);
  assert.match(pilot, /linearGradient id="pilot-jacket"/);
  assert.doesNotMatch(pilot, /seven-pilot-hair|seven-pilot-eye-left|seven-pilot-mouth/);
});


test('Naija Pidgin preference is shared across public pages and respects account preference', () => {
  const language = source('../../apps/web/src/lib/sevenLanguage.ts');
  const profile = source('../../apps/web/src/pages/customer/ProfileView.tsx');
  assert.match(language, /7even-language-style/);
  assert.match(language, /7even-language-change/);
  assert.match(publicShell, /useSevenLanguage/);
  assert.match(publicShell, /user\?\.profileDetails\?\.preferredLanguage/);
  assert.match(landing, /7even-language-change/);
  assert.match(explore, /useSevenLanguage/);
  assert.match(account, /useSevenLanguage/);
  assert.match(profile, /preferredLanguage/);
  assert.match(profile, /Naija Pidgin/);
});

test('Naija Pidgin keeps verified availability and payment wording explicit', () => {
  assert.match(explore, /Confirm room availability, final price and capacity before you book/);
  assert.match(explore, /Only verified 7even stays/);
});


test('Naija Pidgin reaches hotel detail, booking, sign-in, profile and customer updates', () => {
  const languageHook = /useSevenLanguage/;
  const offering = source('../../apps/web/src/pages/public/OfferingPage.tsx');
  const bookingPanel = source('../../apps/web/src/pages/public/BookingPanel.tsx');
  const auth = source('../../apps/web/src/pages/public/AuthPage.tsx');
  const profile = source('../../apps/web/src/pages/customer/ProfileView.tsx');
  const updates = source('../../apps/web/src/pages/customer/ActivityView.tsx');
  const bookings = source('../../apps/web/src/pages/customer/BookingList.tsx');
  for (const page of [offering, bookingPanel, auth, profile, updates, bookings]) {
    assert.match(page, languageHook);
    assert.match(page, /const pcm =/);
  }
  assert.match(bookingPanel, /When you go enter/);
  assert.match(profile, /preferredLanguage/);
  assert.match(updates, /Mark as read/);
  assert.match(bookings, /verified payment and availability/);
});
