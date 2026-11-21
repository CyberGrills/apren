import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const palette = await readFile(new URL('../styles/brand-palette.css', import.meta.url), 'utf8');
const context = await readFile(new URL('../context/SeasonContext.tsx', import.meta.url), 'utf8');
const appearance = await readFile(new URL('../styles/appearance.css', import.meta.url), 'utf8');
const entry = await readFile(new URL('../main.tsx', import.meta.url), 'utf8');
const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8');

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


test('summer and autumn have distinct, accessible seasonal identities in both modes', () => {
  assert.match(palette, /--season-summer:\s*#966000/);
  assert.match(palette, /--season-autumn:\s*#994626/);
  assert.match(palette, /data-mode="dark"\]\[data-season="summer"\].*#F5C85C/);
  assert.match(palette, /data-mode="dark"\]\[data-season="autumn"\].*#E98B55/);
  assert.doesNotMatch(palette, /data-season="summer"\]\s*\{\s*--season-accent:\s*var\(--summer-terracotta\)/);
});

test('appearance overrides load after every page stylesheet and cover shared page surfaces', () => {
  assert.ok(entry.lastIndexOf("import './styles/appearance.css'") > entry.lastIndexOf("import './styles/christmas-unplugged.css'"));
  assert.match(appearance, /:root\[data-mode="dark"\]/);
  assert.match(appearance, /\.workspace-sidebar/);
  assert.match(appearance, /\.public-page/);
  assert.match(appearance, /\.ibom-events-section/);
  assert.match(appearance, /\.ibom-event-card/);
  assert.match(appearance, /\.customer-main/);
});

test('saved appearance is applied before the React app paints', () => {
  assert.match(html, /localStorage\.getItem\("7even-color-mode"\)/);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(html, /root\.dataset\.mode/);
  assert.match(html, /7even-season-theme/);
  assert.match(html, /const root = document\.documentElement/);
  assert.match(html, /root\.dataset\.season/);
  assert.match(html, /themeColor\.content = dark \? "#111A15" : "#fffdf8"/);
});


test('service worker rotates the cached shell so installed clients receive appearance fixes', () => {
  assert.match(serviceWorker, /const SHELL_CACHE = 'seven-shell-v7'/);
  assert.match(serviceWorker, /key\.startsWith\('seven-shell-'\) && key !== SHELL_CACHE/);
});
