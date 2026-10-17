import test from 'node:test';
import assert from 'node:assert/strict';
import { applySyncResults, type StoredAction } from '../../apps/web/src/lib/receptionQueue.ts';
const pending = (id: string): StoredAction => ({
  event: {
    eventId: id,
    schemaVersion: 1,
    reservationId: 'reservation',
    expectedRevision: 1,
    action: 'CHECK_IN',
    occurredAt: '2026-10-16T10:00:00.000Z',
  },
  state: 'PENDING',
});
test('acknowledged and duplicate reception actions leave the queue once', () => {
  const items = [pending('one'), pending('two')];
  const next = applySyncResults(items, {
    serverTime: '2026-10-16T10:00:01Z',
    outcomes: [
      { eventId: 'one', status: 'APPLIED' },
      { eventId: 'two', status: 'DUPLICATE' },
    ],
  });
  assert.deepEqual(next, []);
  assert.equal(items.length, 2);
});
test('reception conflicts are visible and never silently retried', () => {
  const next = applySyncResults([pending('one')], {
    serverTime: '2026-10-16T10:00:01Z',
    outcomes: [{ eventId: 'one', status: 'CONFLICT', message: 'The reservation changed.' }],
  });
  assert.equal(next[0]?.state, 'CONFLICT');
  assert.equal(next[0]?.message, 'The reservation changed.');
});
test('an incomplete response preserves unacknowledged reception actions', () => {
  const first = pending('one');
  const second = pending('two');
  const next = applySyncResults([first, second], {
    serverTime: '2026-10-16T10:00:01Z',
    outcomes: [{ eventId: 'one', status: 'REJECTED', message: 'Access revoked.' }],
  });
  assert.equal(next[0]?.state, 'REJECTED');
  assert.deepEqual(next[1], second);
});

const { indexedDB: fakeIndexedDB } = await import('fake-indexeddb');
Object.defineProperty(globalThis, 'indexedDB', { value: fakeIndexedDB, configurable: true });
const { appendQueue, mutateQueue, readQueue, clearQueues, restrictQueueOwner } = await import(
  '../../apps/web/src/lib/receptionQueue.ts'
);
test('twenty simultaneous reception writes retain every distinct action', async () => {
  await clearQueues();
  await Promise.all(
    Array.from({ length: 20 }, (_, index) => {
      const item = pending(`concurrent-${index}`);
      item.event.reservationId = `reservation-${index}`;
      return appendQueue('actor:business:source', item);
    }),
  );
  const rows = await readQueue('actor:business:source');
  assert.equal(rows.length, 20);
  assert.equal(new Set(rows.map((r) => r.event.eventId)).size, 20);
});
test('a server acknowledgment preserves an action added while the request was in flight', async () => {
  await clearQueues();
  await appendQueue('actor:business:source', pending('first'));
  const inflight = await readQueue('actor:business:source');
  const later = pending('later');
  later.event.reservationId = 'later-reservation';
  await appendQueue('actor:business:source', later);
  await mutateQueue('actor:business:source', (current) =>
    applySyncResults(current, {
      serverTime: '2026-10-16T10:00:01Z',
      outcomes: [{ eventId: inflight[0]!.event.eventId, status: 'APPLIED' }],
    }),
  );
  assert.deepEqual(
    (await readQueue('actor:business:source')).map((r) => r.event.eventId),
    ['later'],
  );
});
test('two tabs cannot add conflicting local operations for one reservation', async () => {
  await clearQueues();
  const outcomes = await Promise.allSettled([
    appendQueue('actor:business:source', pending('one')),
    appendQueue('actor:business:source', pending('two')),
  ]);
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await readQueue('actor:business:source')).length, 1);
});
test('changing actor or business purges the other reception queue', async () => {
  await clearQueues();
  await appendQueue('one:business:source', pending('one'));
  await appendQueue('two:business:source', pending('two'));
  await restrictQueueOwner('two:business:');
  assert.deepEqual(await readQueue('one:business:source'), []);
  assert.equal((await readQueue('two:business:source')).length, 1);
  await restrictQueueOwner(null);
  assert.deepEqual(await readQueue('two:business:source'), []);
});
