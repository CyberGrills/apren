import assert from 'node:assert/strict';
import test from 'node:test';
import type { InventoryWindow } from '@7even/contracts';
import { upcomingInventory } from './businessWorkspace.ts';

test('business availability shows current and future windows in service order', () => {
  const window = (id: string, startAt: string, endAt: string): InventoryWindow => ({
    id,
    startAt,
    endAt,
    serviceDate: startAt.slice(0, 10),
    capacity: 3,
    remaining: 2,
    revision: 1,
  });
  const now = Date.parse('2026-10-22T12:00:00Z');
  const windows = [
    window('future', '2026-10-23T10:00:00Z', '2026-10-24T10:00:00Z'),
    window('past', '2026-10-20T10:00:00Z', '2026-10-21T10:00:00Z'),
    window('current', '2026-10-22T10:00:00Z', '2026-10-23T10:00:00Z'),
    window('ended', '2026-10-21T10:00:00Z', '2026-10-22T12:00:00Z'),
  ];
  assert.deepEqual(
    upcomingInventory(windows, now).map((item) => item.id),
    ['current', 'future'],
  );
  assert.equal(windows[0]?.id, 'future');
  assert.deepEqual(upcomingInventory([], now), []);
});
