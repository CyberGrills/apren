-- Track when a partner explicitly confirmed room inventory, separate from booking allocations.
-- Existing windows are deliberately marked stale until an owner confirms them through the availability API.
ALTER TABLE seven.inventory_windows
  ADD COLUMN inventory_confirmed_at timestamptz;

UPDATE seven.inventory_windows
SET inventory_confirmed_at = '2000-01-01 00:00:00+00'::timestamptz;

ALTER TABLE seven.inventory_windows
  ALTER COLUMN inventory_confirmed_at SET DEFAULT now();

ALTER TABLE seven.inventory_windows
  ALTER COLUMN inventory_confirmed_at SET NOT NULL;

COMMENT ON COLUMN seven.inventory_windows.inventory_confirmed_at IS
  'Last partner confirmation of room/resource capacity; transactional allocations must not refresh this timestamp.';

CREATE INDEX IF NOT EXISTS inventory_windows_fresh_available_idx
  ON seven.inventory_windows (offering_id, inventory_confirmed_at, starts_at, ends_at)
  WHERE capacity > allocated_count;
