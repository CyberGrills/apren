import assert from 'node:assert/strict';
import testCase from 'node:test';
import {
  getPilotVisemeWeights,
  validatePilotVisemeTimeline,
  type PilotVisemeTimeline,
} from './pilotVisemeTimeline.ts';

const validTimeline: PilotVisemeTimeline = {
  version: 1,
  language: 'en',
  durationMs: 1200,
  cues: [
    { startMs: 0, endMs: 180, viseme: 'sil' },
    { startMs: 150, endMs: 420, viseme: 'PP', weight: 0.9 },
    { startMs: 390, endMs: 700, viseme: 'aa' },
  ],
};

testCase('accepts ordered, overlapping viseme cues for co-articulation', () => {
  const result = validatePilotVisemeTimeline(validTimeline);
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.timeline.cues.length, 3);
});

testCase('rejects unsupported visemes and out-of-range cue timing', () => {
  const result = validatePilotVisemeTimeline({
    ...validTimeline,
    cues: [
      { startMs: -1, endMs: 20, viseme: 'aa' },
      { startMs: 30, endMs: 1300, viseme: 'unknown' },
    ],
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((error) => error.includes('startMs')));
    assert.ok(result.errors.some((error) => error.includes('durationMs')));
    assert.ok(result.errors.some((error) => error.includes('unsupported viseme')));
  }
});

testCase('rejects cues that are not ordered by start time', () => {
  const result = validatePilotVisemeTimeline({
    ...validTimeline,
    cues: [
      { startMs: 300, endMs: 400, viseme: 'aa' },
      { startMs: 100, endMs: 200, viseme: 'PP' },
    ],
  });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes('Cues must be ordered by startMs.'));
});

testCase('blends cue edges and preserves overlap weights', () => {
  const result = validatePilotVisemeTimeline(validTimeline);
  assert.equal(result.valid, true);
  if (!result.valid) return;

  const weights = getPilotVisemeWeights(result.timeline, 200, 0);
  assert.equal(weights.PP, 0.9);
  assert.equal(weights.sil, undefined);
});

testCase('returns no active visemes during silence or for invalid time', () => {
  const result = validatePilotVisemeTimeline(validTimeline);
  assert.equal(result.valid, true);
  if (!result.valid) return;

  assert.deepEqual(getPilotVisemeWeights(result.timeline, 900), {});
  assert.deepEqual(getPilotVisemeWeights(result.timeline, Number.NaN), {});
});
