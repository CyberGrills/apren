import type { PilotViseme } from './pilotVisemeTimeline.ts';

export interface PilotMorphTargetBinding {
  /** Exact morph-target name supplied by the delivered GLB manifest. */
  target: string;
  /** Optional per-target scale, clamped to the supported 0..1 range. */
  multiplier?: number;
}

export type PilotMorphTargetMap = Partial<
  Record<PilotViseme, readonly PilotMorphTargetBinding[]>
>;

export interface PilotMorphTargetSink {
  setMorphTargetWeight(target: string, weight: number): void;
}

export interface PilotMorphTargetDriver {
  apply(weights: Partial<Record<PilotViseme, number>>): void;
  reset(): void;
}

/**
 * Adapts language-independent viseme weights to the exact morph-target names
 * provided by a character asset manifest. No rig names are assumed here.
 */
export function createPilotMorphTargetDriver(
  mapping: PilotMorphTargetMap,
  sink: PilotMorphTargetSink,
): PilotMorphTargetDriver {
  const targetNames = new Set<string>();

  for (const [viseme, bindings] of Object.entries(mapping)) {
    if (!Array.isArray(bindings)) {
      throw new TypeError(`Morph-target bindings for ${viseme} must be an array.`);
    }
    for (const binding of bindings) {
      if (!binding || typeof binding.target !== 'string' || binding.target.trim().length === 0) {
        throw new TypeError(`Morph-target binding for ${viseme} requires a target name.`);
      }
      const multiplier = binding.multiplier ?? 1;
      if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 1) {
        throw new RangeError(`Morph-target multiplier for ${binding.target} must be between 0 and 1.`);
      }
      targetNames.add(binding.target);
    }
  }

  const knownTargets = [...targetNames];

  function reset(): void {
    for (const target of knownTargets) sink.setMorphTargetWeight(target, 0);
  }

  function apply(weights: Partial<Record<PilotViseme, number>>): void {
    const next = new Map<string, number>();
    for (const [viseme, rawWeight] of Object.entries(weights)) {
      const bindings = mapping[viseme as PilotViseme];
      if (!bindings || typeof rawWeight !== 'number' || !Number.isFinite(rawWeight)) continue;
      const weight = Math.max(0, Math.min(1, rawWeight));
      for (const binding of bindings) {
        const scaled = weight * (binding.multiplier ?? 1);
        next.set(binding.target, Math.max(next.get(binding.target) ?? 0, scaled));
      }
    }

    for (const target of knownTargets) {
      sink.setMorphTargetWeight(target, next.get(target) ?? 0);
    }
  }

  return { apply, reset };
}
