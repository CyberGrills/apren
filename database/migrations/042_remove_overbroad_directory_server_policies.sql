-- Remove permissive legacy server-role policies that bypass the newer
-- kind <> 'STAY' predicates. PostgreSQL ORs permissive policies together.
-- Public and server directory reads must never expose unverified hotel leads.
DROP POLICY IF EXISTS discovery_listings_server_read ON seven.discovery_listings;
DROP POLICY IF EXISTS state_directories_server_read ON seven.state_directories;
