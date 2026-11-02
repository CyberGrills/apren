-- Keep the migration ledger private to the application and read-only server roles.
-- Match the least-privilege policy contract already used by Production.
ALTER TABLE seven.migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seven_app_server_access ON seven.migrations;
CREATE POLICY seven_app_server_access
  ON seven.migrations
  FOR ALL TO seven_app
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS seven_readonly_select_access ON seven.migrations;
CREATE POLICY seven_readonly_select_access
  ON seven.migrations
  FOR SELECT TO seven_readonly
  USING (true);
