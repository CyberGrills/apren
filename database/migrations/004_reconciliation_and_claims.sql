-- Small new platform tables, no legacy backfill. Mutable replay result completes a durable claim.
GRANT UPDATE(response_body) ON seven.idempotencies TO seven_app;
ALTER TABLE seven.payment_attempts ADD COLUMN settlement_checks integer NOT NULL DEFAULT 0;
ALTER TABLE seven.payment_attempts ADD COLUMN next_settlement_check_at timestamptz NOT NULL DEFAULT now();
COMMENT ON COLUMN seven.payment_attempts.settlement_checks IS 'Bounded provider reconciliation attempts; exhausted work stays visible for review.';
COMMENT ON COLUMN seven.payment_attempts.next_settlement_check_at IS 'Backoff avoids repeatedly querying unchanged provider state.';
