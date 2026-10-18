-- Pin name resolution for trigger functions in the hosted Postgres runtime.
-- All table references are schema-qualified; this removes mutable search_path resolution.
ALTER FUNCTION seven.enforce_money_balance() SET search_path = pg_catalog, seven;
ALTER FUNCTION seven.enforce_points_balance() SET search_path = pg_catalog, seven;
ALTER FUNCTION seven.prevent_journal_mutation() SET search_path = pg_catalog, seven;
ALTER FUNCTION seven.enforce_payment_attempt_binding() SET search_path = pg_catalog, seven;
ALTER FUNCTION seven.enforce_refund_provider_binding() SET search_path = pg_catalog, seven;
ALTER FUNCTION seven.enforce_crypto_quote_binding() SET search_path = pg_catalog, seven;
