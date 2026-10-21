-- The seven schema is accessed through the trusted server-side PostgreSQL roles.
-- Enable RLS on every existing table. Migration 013 adds explicit policies for the
-- established server roles only; public Data API roles remain unprivileged.
DO $migration$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'seven'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      item.schema_name,
      item.table_name
    );
  END LOOP;
END
$migration$;
