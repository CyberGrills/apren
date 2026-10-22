import type { InventoryWindow } from '@7even/contracts';

export function upcomingInventory(
  windows: readonly InventoryWindow[],
  now = Date.now(),
): InventoryWindow[] {
  return windows
    .filter((window) => Date.parse(window.endAt) > now)
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt));
}
