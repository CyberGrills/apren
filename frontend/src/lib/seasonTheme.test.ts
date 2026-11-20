import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const palette = await readFile(new URL('../styles/brand-palette.css', import.meta.url), 'utf8');
const context = await readFile(new URL('../context/SeasonContext.tsx', import.meta.url), 'utf8');

test('every seasonal choice changes the shared accent and surface palette', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const selector = ':root\\[data-season="' + season + '"\\]\\s*\\{([^}]*)\\}';
    const rule = palette.match(new RegExp(selector));
    assert.ok(rule, 'Missing ' + season + ' theme tokens');
    assert.match(rule[1]!, /--season-accent:/, season + ' must define its accent');
    assert.match(rule[1]!, /--season-tint:/, season + ' must define its tint');
  }
  assert.match(palette, /--accent:\s*var\(--season-accent\)/);
  assert.match(palette, /--accent-hover:\s*color-mix/);
  assert.match(palette, /--season-surface:\s*color-mix/);
});

test('the selected seasonal preference persists and is applied to the document root', () => {
  assert.match(context, /localStorage\.getItem\(preferenceKey\)/);
  assert.match(context, /localStorage\.setItem\(preferenceKey, preference\)/);
  assert.match(context, /useLayoutEffect\(\(\) => \{\s*document\.documentElement\.dataset\.season = season;/);
  assert.match(context, /preference === 'auto' \? calendarSeason : preference/);
});


test('light, dark and system appearance preferences persist and apply to the document root', () => {
  assert.match(context, /const modePreferenceKey = '7even-color-mode'/);
  assert.match(context, /localStorage\.getItem\(modePreferenceKey\)/);
  assert.match(context, /localStorage\.setItem\(modePreferenceKey, modePreference\)/);
  assert.match(context, /modePreference === 'system' \? systemMode : modePreference/);
  assert.match(context, /document\.documentElement\.dataset\.mode = mode/);
  assert.match(context, /prefers-color-scheme: dark/);
});

test('dark mode defines readable semantic tokens and season-aware accents', () => {
  assert.match(palette, /:root\[data-mode="dark"\]\s*\{[^}]*--paper:[^}]*--ink:[^}]*--surface:/s);
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    assert.match(palette, new RegExp(':root\\[data-mode="dark"\\]\\[data-season="' + season + '"\\]\\s*\\{\\s*--season-accent:'));
  }
});
