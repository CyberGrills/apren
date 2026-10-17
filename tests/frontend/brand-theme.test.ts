import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { seasonalCampaigns } from '../../apps/web/src/lib/seasonalCampaigns.ts';
import { editorialImages } from '../../apps/web/src/lib/editorialImages.ts';
import type { Season } from '../../apps/web/src/lib/season.ts';

const sheet = readFileSync(
  new URL('../../apps/web/src/styles/global.css', import.meta.url),
  'utf8',
);
const declarations = (body: string) =>
  Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2]?.trim()]),
  );
const root = declarations(sheet.match(/^:root\s*\{([^}]+)\}/)?.[1] ?? '');
const brand = {
  '--brand-primary': '#2b4a33',
  '--brand-secondary': '#fffdf8',
  '--brand-tertiary': '#e1d6b8',
  '--brand-text': '#241f18',
  '--brand-text-muted': '#7a7161',
};
for (const [token, expected] of Object.entries(brand))
  test(`${token} retains the supplied brand value`, () =>
    assert.equal(root[token]?.toLowerCase(), expected));
for (const [alias, token] of Object.entries({
  '--paper': '--brand-secondary',
  '--surface': '--brand-secondary',
  '--accent': '--brand-primary',
  '--line': '--brand-tertiary',
  '--ink': '--brand-text',
  '--muted': '--brand-text-muted',
})) {
  test(`${alias} uses the shared brand token`, () => assert.equal(root[alias], `var(${token})`));
}
const seasonalColors = {
  spring: '#8baa8a',
  summer: '#c67b55',
  autumn: '#b77943',
  winter: '#466c78',
} as const;
for (const [season, color] of Object.entries(seasonalColors)) {
  test(`${season} changes only the campaign accent`, () => {
    assert.equal(root[`--season-${season}`]?.toLowerCase(), color);
    const selector = new RegExp(`:root\\[data-season="${season}"\\]\\s*\\{([^}]+)\\}`);
    assert.deepEqual(declarations(sheet.match(selector)?.[1] ?? ''), {
      '--season-accent': `var(--season-${season})`,
    });
  });
}
function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  assert.equal(channels?.length, 3);
  return (
    0.2126 * (channels?.[0] ?? 0) + 0.7152 * (channels?.[1] ?? 0) + 0.0722 * (channels?.[2] ?? 0)
  );
}
function contrast(first: string, second: string) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
for (const [name, foreground, background, minimum] of [
  ['primary action text', brand['--brand-secondary'], brand['--brand-primary'], 4.5],
  ['body text', brand['--brand-text'], brand['--brand-secondary'], 4.5],
  ['muted text', brand['--brand-text-muted'], brand['--brand-secondary'], 4.5],
  ['input boundary', brand['--brand-text-muted'], brand['--brand-secondary'], 3],
] as const)
  test(`${name} meets its contrast threshold`, () =>
    assert.ok(contrast(foreground, background) >= minimum));
test('sand remains a decorative border while input boundaries use readable taupe', () => {
  assert.equal(root['--control-border'], 'var(--brand-text-muted)');
  assert.match(
    sheet,
    /input,\s*select,\s*textarea\s*\{[^}]*border:\s*1px solid var\(--control-border\)/,
  );
});
for (const [season, campaign] of Object.entries(seasonalCampaigns) as [
  Season,
  (typeof seasonalCampaigns)[Season],
][]) {
  test(`${season} has distinct copy and a credited existing editorial photograph`, () => {
    assert.match(campaign.label.toLowerCase(), new RegExp(season));
    assert.ok(campaign.message.length > 40);
    assert.ok(Object.values(editorialImages).some((source) => source === campaign.image.src));
    assert.equal(new URL(campaign.image.src).hostname, 'images.unsplash.com');
    assert.match(campaign.image.alt, /illustrative stock/i);
    assert.match(campaign.image.caption, /illustrative stock/i);
    assert.match(campaign.image.credit, /Photo: .+ \/ Unsplash/);
    assert.ok(campaign.image.width > 0 && campaign.image.height > 0);
  });
}
test('the four campaigns actually change message and photograph', () => {
  assert.equal(
    new Set(Object.values(seasonalCampaigns).map((campaign) => campaign.message)).size,
    4,
  );
  assert.equal(
    new Set(Object.values(seasonalCampaigns).map((campaign) => campaign.image.src)).size,
    4,
  );
});
test('installed-app metadata uses the fixed ivory brand background', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../apps/web/public/manifest.webmanifest', import.meta.url), 'utf8'),
  );
  assert.equal(manifest.theme_color.toLowerCase(), brand['--brand-secondary']);
  assert.equal(manifest.background_color.toLowerCase(), brand['--brand-secondary']);
  const html = readFileSync(new URL('../../apps/web/index.html', import.meta.url), 'utf8');
  assert.match(html, /name="theme-color" content="#fffdf8"/i);
});
