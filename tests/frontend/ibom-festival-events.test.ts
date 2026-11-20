import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const explore = readFileSync(new URL('../../frontend/src/pages/public/ExplorePage.tsx', import.meta.url), 'utf8');
const component = readFileSync(new URL('../../frontend/src/pages/public/IbomFestivalEvents.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../frontend/src/styles/christmas-unplugged.css', import.meta.url), 'utf8');

test('What to Do includes all 20 organiser-listed Ibom Christmas Unplugged events', () => {
  assert.ok(explore.includes("kind === 'EXPERIENCE' && <IbomFestivalEvents />"));
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
  assert.ok(component.includes('ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/'));
  assert.ok(component.includes('Festival Media Centre'));
  assert.ok(component.includes('Event-specific poster not yet published'));
});

test('event details stay on 7EVEN and clearly show free visitor entry', () => {
  assert.ok(component.includes('View event on 7EVEN'));
  assert.ok(component.includes('aria-expanded={expandedEvent === event.title}'));
  assert.ok(component.includes('ibom-event-details-'));
  assert.ok(component.includes('Entry: Free for visitors'));
  assert.ok(component.includes('Visitor entry is free'));
  assert.ok(component.includes('does not sell tickets'));
  assert.ok(!component.includes('Full official programme'));
  assert.ok(!component.includes('scheduleUrl'));
  assert.ok(!component.includes('target="_blank"'));
});

test('event directory supports accessible search, month filtering and responsive cards', () => {
  assert.ok(component.includes('aria-label="Search festival events"'));
  assert.ok(component.includes('aria-pressed={month === item.value}'));
  assert.ok(component.includes('aria-live="polite"'));
  assert.ok(css.includes('.ibom-events-grid'));
  assert.ok(css.includes('@media(max-width:650px)'));
  assert.ok(css.includes('@media(max-width:390px)'));
});
