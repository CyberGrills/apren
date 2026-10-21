-- Preserve the current database authorization boundary while enabling RLS:
-- seven_app receives row access only where its existing table grants allow it;
-- seven_readonly receives SELECT row access only where it already has SELECT.
-- These policies do not grant table/sequence/function privileges by themselves.
DO $policy$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT c.oid AS table_oid, n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'seven'
      AND c.relkind IN ('r', 'p')
  LOOP
    IF (
      has_table_privilege('seven_app', item.table_oid, 'SELECT')
      OR has_table_privilege('seven_app', item.table_oid, 'INSERT')
      OR has_table_privilege('seven_app', item.table_oid, 'UPDATE')
      OR has_table_privilege('seven_app', item.table_oid, 'DELETE')
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = item.table_oid
        AND p.polname = 'seven_app_server_access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO seven_app USING (true) WITH CHECK (true)',
        'seven_app_server_access',
        item.schema_name,
        item.table_name
      );
    END IF;

    IF has_table_privilege('seven_readonly', item.table_oid, 'SELECT')
      AND NOT EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = item.table_oid
          AND p.polname = 'seven_readonly_select_access'
      ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR SELECT TO seven_readonly USING (true)',
        'seven_readonly_select_access',
        item.schema_name,
        item.table_name
      );
    END IF;
  END LOOP;
END
$policy$;
