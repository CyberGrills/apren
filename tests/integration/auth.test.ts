import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, digestToken } from '../../services/platform/src/auth.ts';

test('password hashing uses unique salts and rejects another password', async () => {
  const password = 'Seven-test-only!42';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorrect', first), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
  assert.notEqual(digestToken(password), password);
});
