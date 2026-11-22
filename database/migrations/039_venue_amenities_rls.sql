-- Keep venue amenities private to the server application.
-- Public reads go through the approved-venue API projection, not direct table grants.
ALTER TABLE seven.venue_amenities ENABLE ROW LEVEL SECURITY;

CREATE POLICY seven_app_server_access
  ON seven.venue_amenities
  FOR ALL TO seven_app
  USING (true)
  WITH CHECK (true);

CREATE POLICY seven_readonly_select_access
  ON seven.venue_amenities
  FOR SELECT TO seven_readonly
  USING (false);
