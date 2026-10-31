import { PILOT_VISEMES, type PilotViseme } from './pilotVisemeTimeline.ts';
import type { PilotMorphTargetBinding, PilotMorphTargetMap } from './pilotMorphTargetDriver.ts';

export interface PilotCharacterManifest {
  version: 1;
  asset: {
    path: string;
    creator: string;
    license: string;
    attribution: string;
    rightsDocument: string;
  };
  units: 'meters';
  forwardAxis: 'x' | '-x' | 'y' | '-y' | 'z' | '-z';
  meshNames: string[];
  skeletonRoot: string;
  animationClips: {
    idle: string;
    listening: string;
    speaking: string;
  };
  morphTargets: string[];
  visemeMap: PilotMorphTargetMap;
}

export type PilotCharacterManifestValidation =
  | { valid: true; manifest: PilotCharacterManifest }
  | { valid: false; errors: string[] };

const REQUIRED_VISEMES = PILOT_VISEMES.filter((viseme) => viseme !== 'sil');

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates the handoff manifest before a delivered GLB is connected to the
 * renderer. All rig target names must come from the asset; none are guessed.
 */
export function validatePilotCharacterManifest(
  input: unknown,
): PilotCharacterManifestValidation {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ['Manifest must be an object.'] };
  }

  const asset = input.asset;
  const clips = input.animationClips;
  const meshNames = input.meshNames;
  const morphTargets = input.morphTargets;
  const visemeMap = input.visemeMap;

  if (input.version !== 1) errors.push('Manifest version must be 1.');
  if (!isRecord(asset)) {
    errors.push('asset must be an object.');
  } else {
    if (!isNonEmptyString(asset.path) || !asset.path.startsWith('/') || !asset.path.toLowerCase().endsWith('.glb')) {
      errors.push('asset.path must be an absolute public path ending in .glb.');
    }
    for (const field of ['creator', 'license', 'attribution', 'rightsDocument']) {
      if (!isNonEmptyString(asset[field])) errors.push(`asset.${field} must be a non-empty string.`);
    }
  }

  if (input.units !== 'meters') errors.push('units must be meters.');
  if (!['x', '-x', 'y', '-y', 'z', '-z'].includes(String(input.forwardAxis))) {
    errors.push('forwardAxis must identify a positive or negative x, y, or z axis.');
  }

  if (!Array.isArray(meshNames) || meshNames.length === 0 || !meshNames.every(isNonEmptyString)) {
    errors.push('meshNames must contain at least one non-empty mesh name.');
  }
  if (!isNonEmptyString(input.skeletonRoot)) errors.push('skeletonRoot must be a non-empty string.');

  if (!isRecord(clips)) {
    errors.push('animationClips must be an object.');
  } else {
    for (const name of ['idle', 'listening', 'speaking']) {
      if (!isNonEmptyString(clips[name])) errors.push(`animationClips.${name} must be a non-empty clip name.`);
    }
  }

  if (!Array.isArray(morphTargets) || morphTargets.length === 0 || !morphTargets.every(isNonEmptyString)) {
    errors.push('morphTargets must contain at least one non-empty target name.');
  }

  if (!isRecord(visemeMap)) {
    errors.push('visemeMap must be an object.');
  } else {
    const knownTargets = new Set(Array.isArray(morphTargets) ? morphTargets.filter(isNonEmptyString) : []);
    for (const viseme of REQUIRED_VISEMES) {
      const bindings = visemeMap[viseme];
      if (!Array.isArray(bindings) || bindings.length === 0) {
        errors.push(`visemeMap.${viseme} must contain at least one morph-target binding.`);
        continue;
      }
      for (const [index, binding] of bindings.entries()) {
        if (!isRecord(binding) || !isNonEmptyString(binding.target)) {
          errors.push(`visemeMap.${viseme}[${index}] requires an exact target name.`);
          continue;
        }
        if (!knownTargets.has(binding.target)) {
          errors.push(`visemeMap.${viseme}[${index}] references an undeclared morph target: ${binding.target}.`);
        }
        if (binding.multiplier !== undefined &&
          (typeof binding.multiplier !== 'number' || !Number.isFinite(binding.multiplier) || binding.multiplier < 0 || binding.multiplier > 1)) {
          errors.push(`visemeMap.${viseme}[${index}].multiplier must be between 0 and 1.`);
        }
      }
    }
    const unsupported = Object.keys(visemeMap).filter((key) => !PILOT_VISEMES.includes(key as PilotViseme));
    if (unsupported.length > 0) errors.push(`visemeMap contains unsupported visemes: ${unsupported.join(', ')}.`);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    manifest: input as unknown as PilotCharacterManifest,
  };
}
