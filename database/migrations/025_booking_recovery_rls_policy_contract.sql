-- Align booking recovery row-level security policy names with the platform-wide
-- seven_app / seven_readonly policy contract validated by seven-api-boundary.test.ts.
-- The table and grants are created by migration 024; this migration is safe for
-- preview databases where 024 has already been applied.
ALTER TABLE seven.booking_recovery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_recovery_events_app_access
  ON seven.booking_recovery_events;
DROP POLICY IF EXISTS booking_recovery_events_readonly_access
  ON seven.booking_recovery_events;
DROP POLICY IF EXISTS seven_app_server_access
  ON seven.booking_recovery_events;
DROP POLICY IF EXISTS seven_readonly_select_access
  ON seven.booking_recovery_events;

CREATE POLICY seven_app_server_access
  ON seven.booking_recovery_events FOR ALL TO seven_app
  USING (true) WITH CHECK (true);

CREATE POLICY seven_readonly_select_access
  ON seven.booking_recovery_events FOR SELECT TO seven_readonly
  USING (true);
