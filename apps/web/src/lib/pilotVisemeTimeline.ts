export const PILOT_VISEMES = [
  'sil',
  'PP',
  'FF',
  'TH',
  'DD',
  'kk',
  'CH',
  'SS',
  'nn',
  'RR',
  'aa',
  'E',
  'I',
  'O',
  'U',
] as const;

export type PilotViseme = (typeof PILOT_VISEMES)[number];
export type PilotVoiceLanguage = 'en' | 'pcm';

export interface PilotVisemeCue {
  startMs: number;
  endMs: number;
  viseme: PilotViseme;
  weight?: number;
}

export interface PilotVisemeTimeline {
  version: 1;
  language: PilotVoiceLanguage;
  durationMs: number;
  cues: PilotVisemeCue[];
}

export type TimelineValidation =
  | { valid: true; timeline: PilotVisemeTimeline }
  | { valid: false; errors: string[] };

const visemeSet = new Set<string>(PILOT_VISEMES);

/**
 * Validates time-aligned cues exported for one final, mastered actor recording.
 * Cues may overlap to support co-articulation; their weights are combined by max.
 */
export function validatePilotVisemeTimeline(input: unknown): TimelineValidation {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['Timeline must be an object.'] };
  }

  const value = input as Record<string, unknown>;
  if (value.version !== 1) errors.push('Timeline version must be 1.');
  if (value.language !== 'en' && value.language !== 'pcm') {
    errors.push('Language must be en or pcm.');
  }
  if (typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs) || value.durationMs <= 0) {
    errors.push('durationMs must be a finite positive number.');
  }
  if (!Array.isArray(value.cues)) errors.push('cues must be an array.');

  if (errors.length > 0) return { valid: false, errors };

  const durationMs = value.durationMs as number;
  const cues: PilotVisemeCue[] = [];
  let previousStart = -1;

  for (const [index, rawCue] of (value.cues as unknown[]).entries()) {
    if (!rawCue || typeof rawCue !== 'object' || Array.isArray(rawCue)) {
      errors.push(`Cue ${index} must be an object.`);
      continue;
    }

    const cue = rawCue as Record<string, unknown>;
    const { startMs, endMs, viseme } = cue;
    const weight = cue.weight === undefined ? 1 : cue.weight;

    if (typeof startMs !== 'number' || !Number.isFinite(startMs) || startMs < 0) {
      errors.push(`Cue ${index} startMs must be a finite non-negative number.`);
      continue;
    }
    if (typeof endMs !== 'number' || !Number.isFinite(endMs) || endMs <= startMs) {
      errors.push(`Cue ${index} endMs must be greater than startMs.`);
      continue;
    }
    if (endMs > durationMs) errors.push(`Cue ${index} ends after durationMs.`);
    if (startMs < previousStart) errors.push('Cues must be ordered by startMs.');
    if (typeof viseme !== 'string' || !visemeSet.has(viseme)) {
      errors.push(`Cue ${index} uses an unsupported viseme.`);
      continue;
    }
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 1) {
      errors.push(`Cue ${index} weight must be between 0 and 1.`);
      continue;
    }

    previousStart = startMs;
    cues.push({ startMs, endMs, viseme: viseme as PilotViseme, weight });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    timeline: {
      version: 1,
      language: value.language as PilotVoiceLanguage,
      durationMs,
      cues,
    },
  };
}

function smoothstep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Returns blend weights at a recording position. The optional edgeBlendMs
 * softens cue boundaries; callers can apply the returned weights to GLB
 * morph targets once the delivered rig's manifest is known.
 */
export function getPilotVisemeWeights(
  timeline: PilotVisemeTimeline,
  timeMs: number,
  edgeBlendMs = 45,
): Partial<Record<PilotViseme, number>> {
  if (!Number.isFinite(timeMs) || !Number.isFinite(edgeBlendMs) || edgeBlendMs < 0) return {};
  const position = Math.max(0, Math.min(timeline.durationMs, timeMs));
  const weights: Partial<Record<PilotViseme, number>> = {};

  for (const cue of timeline.cues) {
    if (position < cue.startMs || position > cue.endMs) continue;

    const fadeIn = edgeBlendMs === 0
      ? 1
      : smoothstep((position - cue.startMs) / Math.min(edgeBlendMs, cue.endMs - cue.startMs));
    const fadeOut = edgeBlendMs === 0
      ? 1
      : smoothstep((cue.endMs - position) / Math.min(edgeBlendMs, cue.endMs - cue.startMs));
    const weight = (cue.weight ?? 1) * Math.min(fadeIn, fadeOut);
    weights[cue.viseme] = Math.max(weights[cue.viseme] ?? 0, weight);
  }

  return weights;
}
