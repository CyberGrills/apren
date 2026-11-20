import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const explore = readFileSync(new URL('../../frontend/src/pages/public/ExplorePage.tsx', import.meta.url), 'utf8');
const component = readFileSync(new URL('../../frontend/src/pages/public/IbomFestivalEvents.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../frontend/src/styles/christmas-unplugged.css', import.meta.url), 'utf8');

test('What to Do includes all 20 organiser-listed Ibom Christmas Unplugged events', () => {
  assert.match(explore, /kind === 'EXPERIENCE'.*IbomFestivalEvents/s);
  assert.equal((component.match(/date: '2026-/g) || []).length, 20);
  for (const title of [
    'Opening Ceremony', 'Ibom Air Day', 'Civil Service Day', 'Corporate Hangout',
    'Ibom Happy Hour', 'Community Outreach', 'Women’s Day', 'ALGON Night',
    'Akwa Ibom Christmas Carols Festival', 'Niger Delta Day',
    'Mbopo Akwa Ibom Beauty Pageant', 'Arise Football Fiesta',
    'Non-Indigenes Day', 'EXCO-Hangout', 'Children’s Christmas Party',
    'Reggae Night', 'Ibom Golf Tournament', 'Old Skool Night',
    'Ibom Youth Day', 'Cross-Over Service',
  ]) assert.ok(component.includes(title), 'Missing official event: ' + title);
});

test('event artwork is sourced from the official festival host and credited', () => {
  assert.match(component, /ibomfest\\.akwaibomstate\\.gov\\.ng\\/__l5e\\/assets-v1/);
  assert.match(component, /Festival Media Centre/);
  assert.match(component, /event-specific poster not yet published/i);
});

test('event actions go to official event information, not a fake 7EVEN ticket checkout', () => {
  assert.match(component, /https:\\/\\/ibomfest\\.akwaibomstate\\.gov\\.ng\\/schedule/);
  assert.match(component, /target=\"_blank\" rel=\"noopener noreferrer\"/);
  assert.match(component, /does not sell tickets/);
  assert.match(component, /visitor entry is listed as free/i);
});

test('event directory supports accessible search, month filtering and responsive cards', () => {
  assert.match(component, /aria-label=\"Search festival events\"/);
  assert.match(component, /aria-pressed={month === item.value}/);
  assert.match(component, /aria-live=\"polite\"/);
  assert.match(css, /\\.ibom-events-grid/);
  assert.match(css, /@media\\(max-width:650px\\)/);
  assert.match(css, /@media\\(max-width:390px\\)/);
});
