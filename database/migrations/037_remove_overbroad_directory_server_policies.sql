-- Remove legacy shared directory policies after the role-specific least-privilege policies
-- were introduced. PostgreSQL combines permissive policies with OR, so the legacy
-- discovery policy bypassed the later kind <> 'STAY' predicate for server roles.
-- The state-directory policy was also redundant with the role-specific policies.
DROP POLICY IF EXISTS discovery_listings_server_read ON seven.discovery_listings;
DROP POLICY IF EXISTS state_directories_server_read ON seven.state_directories;
