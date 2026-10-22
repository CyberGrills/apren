-- Align directory-table server policies with the standard least-privilege policy names.
-- Migration 013 ran before these tables were introduced, so its table sweep could not cover them.
ALTER TABLE seven.state_directories ENABLE ROW LEVEL SECURITY;
ALTER TABLE seven.discovery_listings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON seven.state_directories, seven.discovery_listings TO seven_app, seven_readonly;

DROP POLICY IF EXISTS seven_app_server_access ON seven.state_directories;
CREATE POLICY seven_app_server_access
  ON seven.state_directories
  FOR SELECT TO seven_app
  USING (is_active = true);

DROP POLICY IF EXISTS seven_readonly_select_access ON seven.state_directories;
CREATE POLICY seven_readonly_select_access
  ON seven.state_directories
  FOR SELECT TO seven_readonly
  USING (is_active = true);

DROP POLICY IF EXISTS seven_app_server_access ON seven.discovery_listings;
CREATE POLICY seven_app_server_access
  ON seven.discovery_listings
  FOR SELECT TO seven_app
  USING (listing_status = 'DIRECTORY_ONLY' AND is_bookable = false);

DROP POLICY IF EXISTS seven_readonly_select_access ON seven.discovery_listings;
CREATE POLICY seven_readonly_select_access
  ON seven.discovery_listings
  FOR SELECT TO seven_readonly
  USING (listing_status = 'DIRECTORY_ONLY' AND is_bookable = false);
