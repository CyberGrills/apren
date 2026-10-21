-- MANUAL PROJECT-ADMIN OPERATION. Do not place this file in database/migrations:
-- the app migration runner runs with a restricted database role and must not ALTER ROLE authenticator.
--
-- Removes the internal server-owned seven schema from PostgREST's exposed schema list.
-- This manual override means the Dashboard exposed-schema setting no longer manages the list.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public';
NOTIFY pgrst, 'reload config';

-- Fail closed even if somebody accidentally re-adds seven to the exposed schema list.
REVOKE ALL ON SCHEMA seven FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA seven FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA seven FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA seven FROM PUBLIC, anon, authenticated, service_role;

-- Prevent future objects created by either migration owner from gaining API defaults.
ALTER DEFAULT PRIVILEGES FOR ROLE seven_owner IN SCHEMA seven
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE seven_owner IN SCHEMA seven
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE seven_owner IN SCHEMA seven
  REVOKE USAGE, SELECT ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA seven
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA seven
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA seven
  REVOKE USAGE, SELECT ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
