import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool, PoolClient } from 'pg';
import {
  isAuthorizedCronRequest,
  runScheduledRecovery,
} from '../../backend/platform/src/scheduledWorker.ts';

function fakePool(acquired: boolean, unlockSucceeds = true) {
  const calls: string[] = [];
  let released = false;
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      return {
        rows: sql.includes('pg_try_advisory_lock')
          ? [{ acquired }]
          : [{ unlocked: unlockSucceeds }],
      };
    },
    release: (destroy?: boolean) => {
      released = destroy ?? false;
    },
  };
  return {
    calls,
    get released() {
      return released;
    },
    pool: { connect: async () => client } as unknown as Pool,
    client: client as unknown as PoolClient,
  };
}

test('cron authorization requires the configured bearer secret in production', () => {
  assert.equal(isAuthorizedCronRequest('Bearer secret-value', 'secret-value', true), true);
  assert.equal(isAuthorizedCronRequest('secret-value', 'secret-value', true), false);
  assert.equal(isAuthorizedCronRequest('Bearer wrong-value', 'secret-value', true), false);
  assert.equal(isAuthorizedCronRequest(undefined, undefined, true), false);
  assert.equal(isAuthorizedCronRequest(undefined, undefined, false), true);
});

test('scheduled recovery takes and releases the cross-instance advisory lock', async () => {
  const fake = fakePool(true);
  let executions = 0;
  const result = await runScheduledRecovery(fake.pool, {} as never, async () => {
    executions++;
  });
  assert.deepEqual(result, { status: 'completed' });
  assert.equal(executions, 1);
  assert.equal(fake.calls.length, 2);
  const acquireQuery = fake.calls[0];
  const releaseQuery = fake.calls[1];
  assert.ok(acquireQuery);
  assert.ok(releaseQuery);
  assert.match(acquireQuery, /pg_try_advisory_lock/);
  assert.match(releaseQuery, /pg_advisory_unlock/);
  assert.equal(fake.released, false);
});

test('scheduled recovery skips work when another instance owns the lock', async () => {
  const fake = fakePool(false);
  let executions = 0;
  const result = await runScheduledRecovery(fake.pool, {} as never, async () => {
    executions++;
  });
  assert.deepEqual(result, { status: 'already_running' });
  assert.equal(executions, 0);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.released, false);
});

test('scheduled recovery destroys its lock connection if the worker fails', async () => {
  const fake = fakePool(true);
  await assert.rejects(
    runScheduledRecovery(fake.pool, {} as never, async () => {
      throw new Error('worker failed');
    }),
    /worker failed/,
  );
  assert.equal(fake.calls.length, 2);
  assert.equal(fake.released, true);
});

test('scheduled recovery destroys a connection when PostgreSQL cannot confirm lock release', async () => {
  const fake = fakePool(true, false);
  await assert.rejects(
    runScheduledRecovery(fake.pool, {} as never, async () => {}),
    /lock could not be released/,
  );
  assert.equal(fake.released, true);
});
