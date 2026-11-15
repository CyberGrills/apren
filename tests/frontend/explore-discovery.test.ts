import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const explore = readSource('../../frontend/src/pages/public/ExplorePage.tsx');
const styles = readSource('../../frontend/src/styles/explore-discovery.css');

test('Explore prioritizes search and results before optional discovery scenes', () => {
  const resultsIndex = explore.indexOf('id="explore-results-region"');
  const mapIndex = explore.indexOf('<GoogleMapsScene />');
  const pilotIndex = explore.indexOf('<ScrollPilotScene />');

  assert.ok(resultsIndex > -1, 'results region is present');
  assert.ok(mapIndex > resultsIndex, 'map follows the results region');
  assert.ok(pilotIndex > resultsIndex, 'virtual guide follows the results region');
  assert.match(explore, /className="explore-secondary-discovery"/);
  assert.match(explore, /aria-labelledby="explore-secondary-title"/);
});

test('Explore makes secondary map and pilot available without a pinned long-scroll interruption', () => {
  assert.match(explore, /<GoogleMapsScene \/>/);
  assert.match(explore, /<ScrollPilotScene \/>/);
  assert.match(styles, /\.explore-secondary-discovery \.seven-pilot-scroll\s*\{\s*min-height:\s*0/);
  assert.match(styles, /\.explore-secondary-discovery \.seven-pilot-sticky\s*\{\s*position:\s*relative/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /min-height: 48px/);
});

test('Explore discovery improvements remain separate from the Kiniz sandbox and contain no invented Kiniz listing', () => {
  assert.doesNotMatch(explore, /Kiniz|kiniz|KINIZ/);
  assert.doesNotMatch(explore, /pricePerNight|available rooms|rooms available/i);
});

test('AI search is described as interpreting requests into filters, not verifying availability', () => {
  assert.match(explore, /turn it into search filters/);
  assert.match(explore, /7even decides which listings remain visible/);
  assert.doesNotMatch(explore, /AI verifies availability|AI-confirmed availability/i);
});
