import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function assertMinimumVersion(packagePath, minimum) {
  const version = lock.packages[packagePath]?.version;
  assert.equal(typeof version, 'string', `missing lockfile entry: ${packagePath}`);
  assert.ok(
    compareVersions(version, minimum) >= 0,
    `${packagePath} must be at least ${minimum}; found ${version}`,
  );
}

test('body-parser includes the compressed-request DoS fix', () => {
  assertMinimumVersion('node_modules/body-parser', '2.4.0');
});

test('qs includes the comma-array stringify DoS fix', () => {
  assertMinimumVersion('node_modules/qs', '6.16.1');
});

test('Nodemailer includes the address-parser recipient handling fixes', () => {
  assertMinimumVersion('node_modules/nodemailer', '10.1.4');
});
