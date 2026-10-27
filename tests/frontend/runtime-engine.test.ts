import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  engines?: { node?: string };
};
const lockfile = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8')) as {
  packages?: { '': { engines?: { node?: string } } };
};

test('root package and lockfile pin the Vercel runtime to Node 24', () => {
  assert.equal(rootPackage.engines?.node, '24.x');
  assert.equal(lockfile.packages?.['']?.engines?.node, rootPackage.engines?.node);
});
