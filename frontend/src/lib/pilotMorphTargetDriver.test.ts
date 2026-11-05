import assert from 'node:assert/strict';
import testCase from 'node:test';
import { createPilotMorphTargetDriver } from './pilotMorphTargetDriver.ts';

function createSink() {
  const values = new Map<string, number>();
  return {
    values,
    setMorphTargetWeight(target: string, weight: number) {
      values.set(target, weight);
    },
  };
}

testCase('maps delivered manifest target names without assuming a rig naming convention', () => {
  const sink = createSink();
  const driver = createPilotMorphTargetDriver({
    PP: [{ target: 'Face_MouthPress', multiplier: 0.8 }],
    aa: [{ target: 'Face_JawDrop' }],
  }, sink);

  driver.apply({ PP: 0.5, aa: 0.7 });

  assert.equal(sink.values.get('Face_MouthPress'), 0.4);
  assert.equal(sink.values.get('Face_JawDrop'), 0.7);
});

testCase('resets inactive targets and prevents stale mouth shapes', () => {
  const sink = createSink();
  const driver = createPilotMorphTargetDriver({
    PP: [{ target: 'MouthPress' }],
    aa: [{ target: 'JawOpen' }],
  }, sink);

  driver.apply({ PP: 1 });
  driver.apply({ aa: 0.6 });

  assert.equal(sink.values.get('MouthPress'), 0);
  assert.equal(sink.values.get('JawOpen'), 0.6);
});

testCase('combines overlapping visemes on a shared target using the strongest weight', () => {
  const sink = createSink();
  const driver = createPilotMorphTargetDriver({
    PP: [{ target: 'MouthShape' }],
    FF: [{ target: 'MouthShape', multiplier: 0.7 }],
  }, sink);

  driver.apply({ PP: 0.4, FF: 0.9 });

  assert.equal(sink.values.get('MouthShape'), 0.63);
});

testCase('clamps runtime weights and resets every mapped target', () => {
  const sink = createSink();
  const driver = createPilotMorphTargetDriver({
    aa: [{ target: 'JawOpen' }],
  }, sink);

  driver.apply({ aa: 2 });
  assert.equal(sink.values.get('JawOpen'), 1);

  driver.reset();
  assert.equal(sink.values.get('JawOpen'), 0);
});

testCase('rejects invalid manifest bindings before touching the rig', () => {
  const sink = createSink();
  assert.throws(
    () => createPilotMorphTargetDriver({
      aa: [{ target: 'JawOpen', multiplier: 1.5 }],
    }, sink),
    RangeError,
  );
  assert.equal(sink.values.size, 0);
});
