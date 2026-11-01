-- Expand the demo wallet ledger type to fit INITIAL_CREDIT.
-- This is a metadata-only widening; no existing ledger rows are rewritten.
ALTER TABLE seven.demo_wallet_entries
  ALTER COLUMN entry_type TYPE varchar(20);
