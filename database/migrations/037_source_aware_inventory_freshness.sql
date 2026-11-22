-- Record inventory provenance and centralise source-specific freshness.
-- Existing rows are intentionally UNKNOWN and remain unbookable until explicitly reconfirmed.
ALTER TABLE seven.inventory_windows
  ADD COLUMN inventory_source text;

UPDATE seven.inventory_windows
SET inventory_source = 'UNKNOWN';

ALTER TABLE seven.inventory_windows
  ALTER COLUMN inventory_source SET DEFAULT 'UNKNOWN',
  ALTER COLUMN inventory_source SET NOT NULL,
  ADD CONSTRAINT inventory_windows_inventory_source_check
    CHECK (inventory_source IN ('MANUAL', 'PMS', 'UNKNOWN'));

COMMENT ON COLUMN seven.inventory_windows.inventory_source IS
  'Authoritative capacity source: MANUAL owner confirmation, PMS partner confirmation, or UNKNOWN legacy/unverified inventory.';

CREATE OR REPLACE FUNCTION seven.inventory_window_is_fresh(
  p_inventory_source text,
  p_inventory_confirmed_at timestamptz,
  p_manual_freshness_hours integer,
  p_allow_sample boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, seven
AS $function$
  SELECT CASE
    WHEN COALESCE(p_allow_sample, false) THEN true
    WHEN p_inventory_source = 'PMS' THEN
      p_inventory_confirmed_at IS NOT NULL
      AND p_inventory_confirmed_at <= statement_timestamp()
      AND p_inventory_confirmed_at > statement_timestamp() - interval '5 minutes'
    WHEN p_inventory_source = 'MANUAL' THEN
      p_manual_freshness_hours BETWEEN 1 AND 168
      AND p_inventory_confirmed_at IS NOT NULL
      AND p_inventory_confirmed_at <= statement_timestamp()
      AND p_inventory_confirmed_at > statement_timestamp() - make_interval(hours => p_manual_freshness_hours)
    ELSE false
  END;
$function$;

ALTER FUNCTION seven.inventory_window_is_fresh(text, timestamptz, integer, boolean)
  OWNER TO seven_owner;
GRANT EXECUTE ON FUNCTION seven.inventory_window_is_fresh(text, timestamptz, integer, boolean)
  TO seven_app, seven_readonly;

CREATE INDEX IF NOT EXISTS inventory_windows_source_fresh_available_idx
  ON seven.inventory_windows (inventory_source, inventory_confirmed_at, offering_id, starts_at, ends_at)
  WHERE capacity > allocated_count;
