import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const explore = readFileSync(
  new URL('../../frontend/src/pages/public/ExplorePage.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../../frontend/src/styles/explore-discovery.css', import.meta.url),
  'utf8',
);

test('stay discovery prioritizes search results before optional map and pilot scenes', () => {
  const resultsRegion = explore.indexOf('id="explore-results-region"');
  const secondarySection = explore.indexOf('className="explore-secondary-discovery"');
  const mapScene = explore.indexOf('<GoogleMapsScene />', secondarySection);
  const pilotScene = explore.indexOf('<ScrollPilotScene />', secondarySection);

  assert.ok(resultsRegion >= 0, 'the primary results region is present');
  assert.ok(secondarySection > resultsRegion, 'optional discovery follows primary results');
  assert.ok(mapScene > secondarySection, 'the map remains available in the secondary section');
  assert.ok(pilotScene > mapScene, 'the virtual pilot remains available after the map');
  assert.match(explore, /aria-labelledby="explore-secondary-title"/);
  assert.match(explore, /<h2 id="explore-secondary-title">Optional discovery views<\/h2>/);
});

test('secondary discovery keeps the pilot from pinning the main results journey', () => {
  assert.match(styles, /\.explore-secondary-discovery \.seven-pilot-scroll\s*\{\s*min-height:\s*0/);
  assert.match(styles, /\.explore-secondary-discovery \.seven-pilot-sticky\s*\{\s*position:\s*relative/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /min-height: 48px/);
});

test('Explore waits for both data sources before showing an empty state', () => {
  assert.match(explore, /!loading && !directoryLoading && !error && !directoryError && data\?\.length === 0/);
  assert.match(explore, /loading \|\| directoryLoading/);
});

test('Explore distinguishes published offerings from non-bookable directory discovery', () => {
  assert.match(explore, /published \$\{data\.length === 1 \? 'offering' : 'offerings'\}/);
  assert.match(explore, /directory-only/);
  assert.match(explore, /cannot be booked through 7even/);
});

test('published bookable offerings appear before directory-only discovery cards', () => {
  const offerings = explore.indexOf('{data && data.length > 0 && (');
  const businessProfiles = explore.indexOf('{directoryProfiles.length > 0 &&');
  const sourceListings = explore.indexOf('{directoryListings.length > 0 &&');
  assert.ok(offerings >= 0, 'published offerings have a results section');
  assert.ok(businessProfiles > offerings, 'directory-only business profiles follow published offerings');
  assert.ok(sourceListings > offerings, 'source-backed directory listings follow published offerings');
});
