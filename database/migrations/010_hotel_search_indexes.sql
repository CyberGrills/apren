-- Search indexes for nationwide hotel discovery.
-- Keep the predicates aligned with the public-offering and available-inventory filters.
CREATE INDEX IF NOT EXISTS offerings_public_sector_created_idx
  ON seven.offerings (sector_id, created_at DESC, offering_id)
  WHERE is_published;

CREATE INDEX IF NOT EXISTS offerings_public_city_created_idx
  ON seven.offerings (lower(city), created_at DESC, offering_id)
  WHERE is_published;

-- The API intentionally supports substring city searches (LIKE '%city%').
-- A plain btree on lower(city) cannot accelerate that predicate; use pg_trgm.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $migration$
DECLARE
  trigram_schema text;
BEGIN
  SELECT n.nspname INTO trigram_schema
  FROM pg_opclass c
  JOIN pg_namespace n ON n.oid = c.opcnamespace
  JOIN pg_am am ON am.oid = c.opcmethod
  WHERE c.opcname = 'gin_trgm_ops' AND am.amname = 'gin'
  ORDER BY n.nspname
  LIMIT 1;

  IF trigram_schema IS NULL THEN
    RAISE EXCEPTION 'pg_trgm gin_trgm_ops operator class is unavailable';
  END IF;

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS offerings_public_city_trgm_idx ON seven.offerings USING gin (lower(city) %I.gin_trgm_ops) WHERE is_published',
    trigram_schema
  );
END $migration$;

CREATE INDEX IF NOT EXISTS businesses_workflow_business_idx
  ON seven.businesses (workflow_state_id, business_id);

CREATE INDEX IF NOT EXISTS inventory_windows_available_offer_dates_idx
  ON seven.inventory_windows (offering_id, starts_at, ends_at)
  WHERE capacity > allocated_count;
