-- Normalize early shorthand-generated constraint labels without changing columns or contracts.
-- Metadata-only on the small new schema; no historical rows are rewritten.
DO $$
DECLARE item record; normalized varchar(63);
BEGIN
 FOR item IN
  SELECT c.conname,c.contype,t.relname,a.attname
  FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=c.conkey[1]
  WHERE n.nspname='seven' AND c.contype IN ('f','u')
    AND ((c.contype='f' AND c.conname NOT LIKE '%\_fk' ESCAPE '\') OR (c.contype='u' AND c.conname NOT LIKE '%\_uk' ESCAPE '\'))
 LOOP
  normalized:=left(item.relname||'_'||item.attname,59)||CASE WHEN item.contype='f' THEN '_fk' ELSE '_uk' END;
  EXECUTE format('ALTER TABLE seven.%I RENAME CONSTRAINT %I TO %I',item.relname,item.conname,normalized);
 END LOOP;
END $$;

-- Financial/operational records are retained through state transitions and compensating events.
-- Runtime deletion is only needed for expired/revoked sessions and bounded recovery retention.
REVOKE DELETE ON seven.users,seven.businesses,seven.venues,seven.memberships,seven.offerings,
 seven.inventory_windows,seven.reservations,seven.allocations,seven.payment_attempts,seven.refunds,
 seven.rewards,seven.entitlements,seven.exchanges,seven.outbox_events,seven.notifications,
 seven.sources,seven.provider_events FROM seven_app;
GRANT UPDATE(updated_at) ON seven.idempotencies TO seven_app;
COMMENT ON COLUMN seven.quotes.terms_snapshot IS 'Immutable accepted title, service kind, venue, dates, cancellation and versioned earning/hold policy.';
COMMENT ON COLUMN seven.quotes.inventory_ids IS 'Canonical ordered inventory UUID list; all windows lock in UUID order before allocation.';
COMMENT ON COLUMN seven.payment_attempts.provider_details IS 'Redacted mode, verification, approved bank snapshot and reconciliation evidence. No card details or API secrets.';
COMMENT ON COLUMN seven.payment_attempts.business_subaccount IS 'Immutable approved Flutterwave collection subaccount code used at checkout.';
COMMENT ON COLUMN seven.payment_attempts.bank_revision IS 'Business settlement mapping revision captured before dispatch; later edits do not redirect history.';
COMMENT ON COLUMN seven.money_postings.account_code IS 'Internal provider clearing, business obligation, platform commission or unallocated receipt account. Amount signs are consistent within balanced journals.';
COMMENT ON COLUMN seven.points_postings.account_code IS 'customer UUID account or named issuance/redemption contra account. Negative customer balance is a frozen noncash shortfall.';
COMMENT ON COLUMN seven.idempotencies.payload_hash IS 'SHA-256 of canonical validated request payload bound to actor and operation.';
COMMENT ON COLUMN seven.sync_events.result_body IS 'Durable applied/conflict/rejected acknowledgement; failed evidence retains stable event identity.';
COMMENT ON COLUMN seven.provider_events.details IS 'Required provider reference and transaction ID with payload fingerprint; no plaintext card/customer payload.';
