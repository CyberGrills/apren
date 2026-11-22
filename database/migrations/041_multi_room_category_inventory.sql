-- One hotel offering may contain multiple room categories.
-- Each room category owns its room-night inventory windows. Existing windows are
-- attached to the sole legacy room category for that offering where one exists.
-- Non-STAY inventory remains offering-scoped (room_type_id IS NULL).

ALTER TABLE seven.stay_room_types
  DROP CONSTRAINT IF EXISTS stay_room_types_offering_id_key;

ALTER TABLE seven.stay_room_types
  ADD COLUMN IF NOT EXISTS name varchar(120) NOT NULL DEFAULT 'Room category';

UPDATE seven.stay_room_types
   SET name = CASE WHEN char_length(btrim(bed_configuration)) BETWEEN 2 AND 120
                   THEN left(btrim(bed_configuration), 120)
                   ELSE 'Room category' END
 WHERE name = 'Room category';

ALTER TABLE seven.stay_room_types
  ADD CONSTRAINT stay_room_types_name_ck
  CHECK (char_length(btrim(name)) BETWEEN 2 AND 120);

CREATE INDEX IF NOT EXISTS stay_room_types_offering_active_idx
  ON seven.stay_room_types (offering_id, is_active, created_at);

ALTER TABLE seven.inventory_windows
  ADD COLUMN IF NOT EXISTS room_type_id uuid;

UPDATE seven.inventory_windows iw
   SET room_type_id = rt.room_type_id
  FROM seven.stay_room_types rt
 WHERE iw.offering_id = rt.offering_id
   AND iw.room_type_id IS NULL;

ALTER TABLE seven.inventory_windows
  ADD CONSTRAINT inventory_windows_room_type_offering_fk
  FOREIGN KEY (room_type_id, offering_id)
  REFERENCES seven.stay_room_types (room_type_id, offering_id)
  ON DELETE RESTRICT;

ALTER TABLE seven.inventory_windows
  DROP CONSTRAINT IF EXISTS inventory_windows_offering_start_uk;

CREATE UNIQUE INDEX inventory_windows_non_stay_offering_start_uk
  ON seven.inventory_windows (offering_id, starts_at)
  WHERE room_type_id IS NULL;

CREATE UNIQUE INDEX inventory_windows_room_type_start_uk
  ON seven.inventory_windows (room_type_id, starts_at)
  WHERE room_type_id IS NOT NULL;

CREATE INDEX inventory_windows_room_type_range_idx
  ON seven.inventory_windows (room_type_id, starts_at)
  WHERE room_type_id IS NOT NULL;

COMMENT ON COLUMN seven.inventory_windows.room_type_id IS
  'Room-category scope for hotel room-night capacity; NULL preserves offering-scoped non-STAY inventory.';
COMMENT ON TABLE seven.stay_room_types IS
  'Multiple independently bookable room categories may belong to one public STAY offering.';
