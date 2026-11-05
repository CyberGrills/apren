import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const explore = readFileSync(
  new URL('../../frontend/src/pages/public/ExplorePage.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../../frontend/src/styles/public.css', import.meta.url),
  'utf8',
);

test('stay discovery lets keyboard users bypass the map and pilot before results', () => {
  const skipLink = explore.indexOf('className="explore-skip-results"');
  const mapScene = explore.indexOf('{isStaySearch && <GoogleMapsScene />}', skipLink);
  const pilotScene = explore.indexOf('{isStaySearch && <ScrollPilotScene />}', mapScene);
  const resultsTarget = explore.indexOf('id="explore-results-region"', pilotScene);

  assert.ok(skipLink >= 0, 'stay search should expose a skip link');
  assert.ok(mapScene > skipLink, 'the map should follow the skip link');
  assert.ok(pilotScene > mapScene, 'the pilot should follow the map');
  assert.ok(resultsTarget > pilotScene, 'the results target should follow both interstitials');
  assert.match(explore, /href="#explore-results-region"/);
  assert.match(explore, /<section[\s\S]*?id="explore-results-region"[\s\S]*?tabIndex=\{-1\}[\s\S]*?role="region"/);
  assert.match(explore, /id="explore-results-region"[\s\S]*?<\/section>\s*<\/main>/);
});

test('the skip link is visible on keyboard focus and respects reduced motion', () => {
  assert.match(styles, /\.explore-skip-results\s*\{/);
  assert.match(styles, /\.explore-skip-results:focus-visible\s*\{/);
  assert.match(styles, /transform:\s*translateY\(0\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.explore-skip-results[\s\S]*?transition:\s*none/);
  assert.match(styles, /#explore-results-region\s*\{[\s\S]*?scroll-margin-top:\s*1rem/);
});
