import assert from 'node:assert/strict';
import testCase from 'node:test';
import { PILOT_VISEMES } from './pilotVisemeTimeline.ts';
import { validatePilotCharacterManifest, type PilotCharacterManifest } from './pilotCharacterManifest.ts';

const morphTargets = PILOT_VISEMES
  .filter((viseme) => viseme !== 'sil')
  .map((viseme) => `face_${viseme}`);

const validManifest: PilotCharacterManifest = {
  version: 1,
  asset: {
    path: '/models/virtual-pilot/character.glb',
    creator: 'Studio Example',
    license: 'Written commercial licence',
    attribution: '7EVEN āprən original character',
    rightsDocument: 'contracts/pilot-character-rights.pdf',
  },
  units: 'meters',
  forwardAxis: '-z',
  meshNames: ['BodyMesh', 'FaceMesh'],
  skeletonRoot: 'Armature',
  animationClips: {
    idle: 'Idle',
    listening: 'Listening',
    speaking: 'Speaking',
  },
  morphTargets,
  visemeMap: Object.fromEntries(
    PILOT_VISEMES
      .filter((viseme) => viseme !== 'sil')
      .map((viseme) => [viseme, [{ target: `face_${viseme}` }]]),
  ),
};

testCase('accepts a complete manifest with explicit delivered rig names and rights metadata', () => {
  const result = validatePilotCharacterManifest(validManifest);
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.manifest.asset.path, '/models/virtual-pilot/character.glb');
});

testCase('rejects missing licensing and attribution details', () => {
  const result = validatePilotCharacterManifest({
    ...validManifest,
    asset: { ...validManifest.asset, rightsDocument: '' },
  });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.includes('rightsDocument')));
});

testCase('rejects viseme mappings that reference names absent from the GLB manifest', () => {
  const result = validatePilotCharacterManifest({
    ...validManifest,
    visemeMap: {
      ...validManifest.visemeMap,
      aa: [{ target: 'guessed_jaw_target' }],
    },
  });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.includes('undeclared morph target')));
});

testCase('requires every speech viseme except silence to have an explicit mapping', () => {
  const { PP: _removed, ...incompleteMap } = validManifest.visemeMap;
  const result = validatePilotCharacterManifest({
    ...validManifest,
    visemeMap: incompleteMap,
  });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.includes('visemeMap.PP')));
});

testCase('rejects invalid asset paths, missing animation clips and unsupported visemes', () => {
  const result = validatePilotCharacterManifest({
    ...validManifest,
    asset: { ...validManifest.asset, path: 'https://example.com/model.glb' },
    animationClips: { ...validManifest.animationClips, speaking: '' },
    visemeMap: { ...validManifest.visemeMap, unknown: [{ target: 'face_aa' }] },
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((error) => error.includes('asset.path')));
    assert.ok(result.errors.some((error) => error.includes('animationClips.speaking')));
    assert.ok(result.errors.some((error) => error.includes('unsupported visemes')));
  }
});
