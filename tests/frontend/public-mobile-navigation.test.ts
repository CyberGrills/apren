import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const shell = readFileSync(
  new URL('../../frontend/src/pages/public/PublicShell.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../../frontend/src/styles/public.css', import.meta.url),
  'utf8',
);

test('public mobile menu returns focus to its trigger when dismissed by Escape or navigation', () => {
  assert.match(shell, /function closeMobileMenu\(\)\s*\{\s*setOpen\(false\);\s*menuButtonRef\.current\?\.focus\(\);/);
  assert.match(shell, /if \(event\.key === 'Escape'\)\s*\{\s*closeMobileMenu\(\);/);
  assert.ok((shell.match(/onClick=\{closeMobileMenu\}/g) ?? []).length >= 6);
});

test('public mobile navigation controls meet minimum touch target heights', () => {
  assert.match(styles, /\.public-mobile-nav a\s*\{[^}]*min-height:\s*48px/s);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.seven-language-switch button\s*\{[^}]*min-height:\s*44px/s);
});
