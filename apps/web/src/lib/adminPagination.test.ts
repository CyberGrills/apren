import assert from 'node:assert/strict';
import test from 'node:test';
import { clampPageToResultRange } from './adminPagination.ts';

test('clamps a requested page when refreshed results shrink', () => {
  assert.equal(clampPageToResultRange(5, 5, 26, 25), 2);
});

test('keeps the current page when the response still covers it', () => {
  assert.equal(clampPageToResultRange(2, 2, 51, 25), 2);
});

test('does not clamp against a response for an older page', () => {
  assert.equal(clampPageToResultRange(3, 2, 1, 25), 3);
});

test('empty results still resolve to the first page', () => {
  assert.equal(clampPageToResultRange(4, 4, 0, 25), 1);
});

test('invalid result metadata does not move the requested page', () => {
  assert.equal(clampPageToResultRange(4, 4, 10, 0), 4);
  assert.equal(clampPageToResultRange(4, 4, Number.NaN, 25), 4);
});
