-- Multi-provider collection and direct business-wallet USDC, 18 October 2026.
-- Target: the small, new local seven schema. Existing tables are backfilled before NOT NULL.
-- Production row counts, lock duration and a staged backfill require operational review first.
-- Expected growth follows reservations (<100,000/year initially); retain financial evidence.
-- PII: approved bank/wallet destinations and labels. Never store keys, seed phrases or card data.
-- UUID main-table IDs are application-generated opaque IDs, matching the existing platform.

CREATE TABLE seven.payment_providers (
 payment_provider_id bigint GENERATED ALWAYS AS IDENTITY,
 provider_code varchar(30) NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT payment_providers_pk PRIMARY KEY(payment_provider_id),
 CONSTRAINT payment_providers_code_uk UNIQUE(provider_code)
);
ALTER TABLE seven.payment_providers OWNER TO seven_owner;
GRANT SELECT ON seven.payment_providers TO seven_app, seven_readonly;
COMMENT ON TABLE seven.payment_providers IS 'Retained processor identities, independent of mock/live execution and payment method.';
INSERT INTO seven.payment_providers(provider_code) VALUES('flutterwave'),('paystack'),('crypto') ON CONFLICT(provider_code) DO NOTHING;

CREATE TABLE seven.payment_methods (
 payment_method_id bigint GENERATED ALWAYS AS IDENTITY,
 method_code varchar(20) NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT payment_methods_pk PRIMARY KEY(payment_method_id),
 CONSTRAINT payment_methods_code_uk UNIQUE(method_code)
);
ALTER TABLE seven.payment_methods OWNER TO seven_owner;
GRANT SELECT ON seven.payment_methods TO seven_app, seven_readonly;
COMMENT ON TABLE seven.payment_methods IS 'Retained checkout methods; native USDC on Base is distinct from fiat bank collection.';
INSERT INTO seven.payment_methods(method_code) VALUES('FIAT'),('USDC_BASE') ON CONFLICT(method_code) DO NOTHING;

CREATE TABLE seven.execution_modes (
 execution_mode_id bigint GENERATED ALWAYS AS IDENTITY,
 execution_mode_code varchar(30) NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT execution_modes_pk PRIMARY KEY(execution_mode_id),
 CONSTRAINT execution_modes_code_uk UNIQUE(execution_mode_code)
);
ALTER TABLE seven.execution_modes OWNER TO seven_owner;
GRANT SELECT ON seven.execution_modes TO seven_app, seven_readonly;
COMMENT ON TABLE seven.execution_modes IS 'Execution adapter for an approved account; mock never establishes real bank or wallet delivery.';
INSERT INTO seven.execution_modes(execution_mode_code) VALUES('mock'),('flutterwave'),('paystack'),('crypto') ON CONFLICT(execution_mode_code) DO NOTHING;

ALTER TABLE seven.payment_attempts ADD COLUMN payment_provider_id bigint;
ALTER TABLE seven.payment_attempts ADD COLUMN payment_method_id bigint;
ALTER TABLE seven.payment_attempts ADD COLUMN routing_policy_version varchar(60);
ALTER TABLE seven.payment_attempts ADD COLUMN receipt_journal_reference varchar(180);
UPDATE seven.payment_attempts
SET payment_provider_id=(SELECT payment_provider_id FROM seven.payment_providers WHERE provider_code='flutterwave'),
 payment_method_id=(SELECT payment_method_id FROM seven.payment_methods WHERE method_code='FIAT'),
 routing_policy_version='legacy-flutterwave';
UPDATE seven.payment_attempts AS attempt
SET receipt_journal_reference=journal.source_reference
FROM seven.money_journals AS journal
WHERE attempt.provider_transaction_id IS NOT NULL
 AND journal.source_reference='receipt:'||attempt.provider_transaction_id;
ALTER TABLE seven.payment_attempts ALTER COLUMN payment_provider_id SET NOT NULL;
ALTER TABLE seven.payment_attempts ALTER COLUMN payment_method_id SET NOT NULL;
ALTER TABLE seven.payment_attempts ALTER COLUMN routing_policy_version SET NOT NULL;
ALTER TABLE seven.payment_attempts ADD CONSTRAINT payment_attempts_payment_provider_fk
 FOREIGN KEY(payment_provider_id) REFERENCES seven.payment_providers(payment_provider_id) ON DELETE RESTRICT;
ALTER TABLE seven.payment_attempts ADD CONSTRAINT payment_attempts_payment_method_fk
 FOREIGN KEY(payment_method_id) REFERENCES seven.payment_methods(payment_method_id) ON DELETE RESTRICT;
ALTER TABLE seven.payment_attempts DROP CONSTRAINT payment_attempts_provider_transaction_id_uk;
ALTER TABLE seven.payment_attempts ADD CONSTRAINT payment_attempts_provider_transaction_uk UNIQUE(payment_provider_id,provider_transaction_id);
COMMENT ON COLUMN seven.payment_attempts.payment_provider_id IS 'Immutable provider identity; historical mock attempts retain their Flutterwave route.';
COMMENT ON COLUMN seven.payment_attempts.payment_method_id IS 'Immutable chosen collection method, selected before dispatch.';
COMMENT ON COLUMN seven.payment_attempts.routing_policy_version IS 'Immutable routing decision revision; legacy attempts never reroute by the current amount threshold.';
COMMENT ON COLUMN seven.payment_attempts.receipt_journal_reference IS 'Write-once exact receipt journal source; historical unprefixed journal identities are preserved without rewriting journals.';
COMMENT ON COLUMN seven.payment_attempts.business_subaccount IS 'Immutable approved provider account code or direct business-wallet destination captured before dispatch.';

ALTER TABLE seven.refunds ADD COLUMN payment_provider_id bigint;
UPDATE seven.refunds AS refund
SET payment_provider_id=attempt.payment_provider_id
FROM seven.payment_attempts AS attempt
WHERE attempt.payment_attempt_id=refund.payment_attempt_id;
ALTER TABLE seven.refunds ALTER COLUMN payment_provider_id SET NOT NULL;
ALTER TABLE seven.refunds ADD CONSTRAINT refunds_payment_provider_fk
 FOREIGN KEY(payment_provider_id) REFERENCES seven.payment_providers(payment_provider_id) ON DELETE RESTRICT;
ALTER TABLE seven.refunds DROP CONSTRAINT refunds_provider_id_uk;
ALTER TABLE seven.refunds ADD CONSTRAINT refunds_provider_refund_uk UNIQUE(payment_provider_id,provider_refund_id);
COMMENT ON COLUMN seven.refunds.payment_provider_id IS 'Originating payment provider; refund IDs are unique only within that provider.';

ALTER TABLE seven.provider_events ADD COLUMN payment_provider_id bigint;
UPDATE seven.provider_events
SET payment_provider_id=(SELECT payment_provider_id FROM seven.payment_providers WHERE provider_code='flutterwave');
ALTER TABLE seven.provider_events ALTER COLUMN payment_provider_id SET NOT NULL;
ALTER TABLE seven.provider_events ADD CONSTRAINT provider_events_payment_provider_fk
 FOREIGN KEY(payment_provider_id) REFERENCES seven.payment_providers(payment_provider_id) ON DELETE RESTRICT;
ALTER TABLE seven.provider_events DROP CONSTRAINT provider_events_event_reference_uk;
ALTER TABLE seven.provider_events ADD CONSTRAINT provider_events_provider_reference_uk UNIQUE(payment_provider_id,event_reference);
COMMENT ON COLUMN seven.provider_events.payment_provider_id IS 'Authenticated endpoint identity used for verification and replay deduplication; pre-migration inbox came from Flutterwave.';

CREATE TABLE seven.business_payment_accounts (
 business_payment_account_id uuid NOT NULL,
 business_id uuid NOT NULL,
 payment_provider_id bigint NOT NULL,
 account_code varchar(160) NOT NULL,
 account_label varchar(100) NOT NULL,
 execution_mode_id bigint NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>=0),
 workflow_state_id bigint NOT NULL,
 details jsonb NOT NULL DEFAULT '{}',
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT business_payment_accounts_pk PRIMARY KEY(business_payment_account_id),
 CONSTRAINT business_payment_accounts_business_provider_uk UNIQUE(business_id,payment_provider_id),
 CONSTRAINT business_payment_accounts_business_fk FOREIGN KEY(business_id) REFERENCES seven.businesses(business_id) ON DELETE RESTRICT,
 CONSTRAINT business_payment_accounts_payment_provider_fk FOREIGN KEY(payment_provider_id) REFERENCES seven.payment_providers(payment_provider_id) ON DELETE RESTRICT,
 CONSTRAINT business_payment_accounts_execution_mode_fk FOREIGN KEY(execution_mode_id) REFERENCES seven.execution_modes(execution_mode_id) ON DELETE RESTRICT,
 CONSTRAINT business_payment_accounts_workflow_state_fk FOREIGN KEY(workflow_state_id) REFERENCES seven.workflow_states(workflow_state_id) ON DELETE RESTRICT
);
ALTER TABLE seven.business_payment_accounts OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE ON seven.business_payment_accounts TO seven_app;
GRANT SELECT ON seven.business_payment_accounts TO seven_readonly;
COMMENT ON TABLE seven.business_payment_accounts IS 'Reviewed provider-specific business destination; revisions are snapshotted by checkouts. Records are retained, never deleted.';
COMMENT ON COLUMN seven.business_payment_accounts.account_code IS 'Processor subaccount code or public business-wallet address, never a credential or private key.';
COMMENT ON COLUMN seven.business_payment_accounts.execution_mode_id IS 'Mock account mappings cannot activate live financial collection.';
COMMENT ON COLUMN seven.business_payment_accounts.revision IS 'Destination mapping revision; historical attempts keep their own account and bank snapshot.';
COMMENT ON COLUMN seven.business_payment_accounts.details IS 'Redacted approved bank mapping or wallet ownership evidence; no unbounded raw provider/customer payloads.';
COMMENT ON COLUMN seven.business_payment_accounts.verified_at IS 'Review evidence timestamp; legacy mappings retain their historical update time and explicit provenance.';
-- Reusing the business UUID is safe for this first provider-account row; future rows get fresh UUIDs.
INSERT INTO seven.business_payment_accounts(
 business_payment_account_id,business_id,payment_provider_id,account_code,account_label,
 execution_mode_id,revision,workflow_state_id,details,verified_at,created_at,updated_at
)
SELECT business.business_id,business.business_id,
 (SELECT payment_provider_id FROM seven.payment_providers WHERE provider_code='flutterwave'),
 business.subaccount_id,left(coalesce(business.details->>'accountLabel','Existing Flutterwave account'),100),
 (SELECT execution_mode_id FROM seven.execution_modes WHERE execution_mode_code=CASE WHEN business.details->>'subaccountMode'='mock' THEN 'mock' ELSE 'flutterwave' END),
 business.bank_revision,
 (SELECT workflow_state_id FROM seven.workflow_states WHERE workflow_state_code='APPROVED'),
 jsonb_build_object('settlementAccount',business.details->'settlementAccount','settlementBankCode',business.details->'settlementBankCode','legacyMapping',true),
 business.updated_at,business.created_at,business.updated_at
FROM seven.businesses AS business
WHERE business.subaccount_id IS NOT NULL
ON CONFLICT(business_id,payment_provider_id) DO NOTHING;

CREATE TABLE seven.crypto_payment_quotes (
 crypto_payment_quote_id uuid NOT NULL,
 payment_attempt_id uuid NOT NULL,
 amount_atoms numeric(78,0) NOT NULL CHECK(amount_atoms>0),
 quote_data jsonb NOT NULL,
 payer_verified_at timestamptz,
 transaction_hash varchar(80),
 transfer_evidence jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT crypto_payment_quotes_pk PRIMARY KEY(crypto_payment_quote_id),
 CONSTRAINT crypto_payment_quotes_payment_attempt_uk UNIQUE(payment_attempt_id),
 CONSTRAINT crypto_payment_quotes_transaction_hash_uk UNIQUE(transaction_hash),
 CONSTRAINT crypto_payment_quotes_payment_attempt_fk FOREIGN KEY(payment_attempt_id) REFERENCES seven.payment_attempts(payment_attempt_id) ON DELETE RESTRICT
);
ALTER TABLE seven.crypto_payment_quotes OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.crypto_payment_quotes TO seven_app;
GRANT UPDATE(payer_verified_at,transaction_hash,transfer_evidence,updated_at) ON seven.crypto_payment_quotes TO seven_app;
GRANT SELECT ON seven.crypto_payment_quotes TO seven_readonly;
COMMENT ON TABLE seven.crypto_payment_quotes IS 'One immutable native-USDC/Base quote per payment attempt; later verified evidence cannot alter the original terms.';
COMMENT ON COLUMN seven.crypto_payment_quotes.amount_atoms IS 'Positive exact integer token atoms; six decimals for native USDC. Never NGN kobo or binary floating point.';
COMMENT ON COLUMN seven.crypto_payment_quotes.quote_data IS 'Frozen chain, native token contract/precision, rate source/retrieval, NGN basis, destination, payer challenge and expiry from the typed gateway.';
COMMENT ON COLUMN seven.crypto_payment_quotes.payer_verified_at IS 'Write-once signature verification time; wallet control is required before public transaction proof is accepted.';
COMMENT ON COLUMN seven.crypto_payment_quotes.transaction_hash IS 'Write-once candidate chain transaction identity; one transaction cannot fund two local crypto quotes.';
COMMENT ON COLUMN seven.crypto_payment_quotes.transfer_evidence IS 'Redacted canonical receipt, exact token transfer and finality observations. A submitted hash alone never establishes funding.';

CREATE TABLE seven.crypto_refund_proofs (
 crypto_refund_proof_id uuid NOT NULL,
 refund_id uuid NOT NULL,
 amount_atoms numeric(78,0) NOT NULL CHECK(amount_atoms>0),
 recipient_address varchar(42) NOT NULL,
 transaction_hash varchar(80) NOT NULL,
 transfer_evidence jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT crypto_refund_proofs_pk PRIMARY KEY(crypto_refund_proof_id),
 CONSTRAINT crypto_refund_proofs_refund_uk UNIQUE(refund_id),
 CONSTRAINT crypto_refund_proofs_transaction_hash_uk UNIQUE(transaction_hash),
 CONSTRAINT crypto_refund_proofs_refund_fk FOREIGN KEY(refund_id) REFERENCES seven.refunds(refund_id) ON DELETE RESTRICT
);
ALTER TABLE seven.crypto_refund_proofs OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.crypto_refund_proofs TO seven_app;
GRANT SELECT ON seven.crypto_refund_proofs TO seven_readonly;
COMMENT ON TABLE seven.crypto_refund_proofs IS 'Append-only independently verified merchant-originated token return; 7even never signs or holds merchant wallet funds.';
COMMENT ON COLUMN seven.crypto_refund_proofs.amount_atoms IS 'Exact token atoms returned on the quoted chain and asset, independently verified against the original crypto payment.';
COMMENT ON COLUMN seven.crypto_refund_proofs.recipient_address IS 'Original verified payer wallet receiving the merchant return, never a caller-selected replacement destination.';
COMMENT ON COLUMN seven.crypto_refund_proofs.transaction_hash IS 'Unique finalized return transaction; a submitted hash alone is not evidence of refund delivery.';
COMMENT ON COLUMN seven.crypto_refund_proofs.transfer_evidence IS 'Retained canonical token transfer and finality evidence; corrections require a separate attributable record.';
CREATE TRIGGER crypto_refund_proofs_immutable BEFORE UPDATE OR DELETE ON seven.crypto_refund_proofs
 FOR EACH ROW EXECUTE FUNCTION seven.prevent_journal_mutation();

CREATE FUNCTION seven.enforce_payment_attempt_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.payment_attempt_id,NEW.reservation_id,NEW.merchant_reference,NEW.payment_provider_id,NEW.payment_method_id,
        NEW.routing_policy_version,NEW.currency_code,NEW.amount_minor,NEW.commission_minor,NEW.business_subaccount,NEW.bank_revision)
    IS DISTINCT FROM
    ROW(OLD.payment_attempt_id,OLD.reservation_id,OLD.merchant_reference,OLD.payment_provider_id,OLD.payment_method_id,
        OLD.routing_policy_version,OLD.currency_code,OLD.amount_minor,OLD.commission_minor,OLD.business_subaccount,OLD.bank_revision)
 THEN RAISE EXCEPTION 'Payment route, amount and approved destination are immutable after creation'; END IF;
 IF OLD.receipt_journal_reference IS NOT NULL AND NEW.receipt_journal_reference IS DISTINCT FROM OLD.receipt_journal_reference
 THEN RAISE EXCEPTION 'Receipt journal reference is immutable once assigned'; END IF;
 IF OLD.provider_transaction_id IS NOT NULL AND NEW.provider_transaction_id IS DISTINCT FROM OLD.provider_transaction_id
 THEN RAISE EXCEPTION 'Verified provider transaction identity is immutable once assigned'; END IF;
 IF ROW(NEW.provider_details->'mode',NEW.provider_details->'settlementAccount',NEW.provider_details->'settlementBankCode')
    IS DISTINCT FROM
    ROW(OLD.provider_details->'mode',OLD.provider_details->'settlementAccount',OLD.provider_details->'settlementBankCode')
 THEN RAISE EXCEPTION 'Payment execution mode and bank snapshot are immutable after creation'; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION seven.enforce_payment_attempt_binding() OWNER TO seven_owner;
COMMENT ON FUNCTION seven.enforce_payment_attempt_binding() IS 'Keeps dispatch routing and financial terms fixed while allowing state and provider verification evidence to progress.';
CREATE TRIGGER payment_attempts_binding_immutable BEFORE UPDATE ON seven.payment_attempts
 FOR EACH ROW EXECUTE FUNCTION seven.enforce_payment_attempt_binding();

CREATE FUNCTION seven.enforce_refund_provider_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_provider bigint;
BEGIN
 SELECT payment_provider_id INTO expected_provider FROM seven.payment_attempts WHERE payment_attempt_id=NEW.payment_attempt_id;
 IF expected_provider IS DISTINCT FROM NEW.payment_provider_id
 THEN RAISE EXCEPTION 'Refund provider must match its originating payment'; END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.refund_id,NEW.payment_attempt_id,NEW.payment_provider_id,NEW.amount_minor,NEW.operation_reference)
     IS DISTINCT FROM ROW(OLD.refund_id,OLD.payment_attempt_id,OLD.payment_provider_id,OLD.amount_minor,OLD.operation_reference)
  THEN RAISE EXCEPTION 'Refund intent and originating provider are immutable'; END IF;
  IF OLD.provider_refund_id IS NOT NULL AND NEW.provider_refund_id IS DISTINCT FROM OLD.provider_refund_id
  THEN RAISE EXCEPTION 'Provider refund identity is immutable once assigned'; END IF;
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION seven.enforce_refund_provider_binding() OWNER TO seven_owner;
COMMENT ON FUNCTION seven.enforce_refund_provider_binding() IS 'Prevents cross-provider refund dispatch and reassignment while permitting outcome reconciliation.';
CREATE TRIGGER refunds_provider_binding BEFORE INSERT OR UPDATE ON seven.refunds
 FOR EACH ROW EXECUTE FUNCTION seven.enforce_refund_provider_binding();

CREATE FUNCTION seven.enforce_crypto_quote_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.crypto_payment_quote_id,NEW.payment_attempt_id,NEW.amount_atoms,NEW.quote_data,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.crypto_payment_quote_id,OLD.payment_attempt_id,OLD.amount_atoms,OLD.quote_data,OLD.created_at)
 THEN RAISE EXCEPTION 'Crypto quote terms are immutable after creation'; END IF;
 IF OLD.payer_verified_at IS NOT NULL AND NEW.payer_verified_at IS DISTINCT FROM OLD.payer_verified_at
 THEN RAISE EXCEPTION 'Crypto payer verification time is immutable once assigned'; END IF;
 IF OLD.transaction_hash IS NOT NULL AND NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash
 THEN RAISE EXCEPTION 'Crypto transaction identity is immutable once assigned'; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION seven.enforce_crypto_quote_binding() OWNER TO seven_owner;
COMMENT ON FUNCTION seven.enforce_crypto_quote_binding() IS 'Protects exact crypto valuation, payer challenge and destination while retaining later verification/finality evidence.';
CREATE TRIGGER crypto_payment_quotes_binding_immutable BEFORE UPDATE ON seven.crypto_payment_quotes
 FOR EACH ROW EXECUTE FUNCTION seven.enforce_crypto_quote_binding();
CREATE TRIGGER crypto_payment_quotes_no_delete BEFORE DELETE ON seven.crypto_payment_quotes
 FOR EACH ROW EXECUTE FUNCTION seven.prevent_journal_mutation();

-- Provider-aware workers claim queues by provider and due time; composite UKs already index provider IDs.
CREATE INDEX provider_events_provider_due_idx ON seven.provider_events(payment_provider_id,next_attempt_at)
 WHERE processed_at IS NULL;
-- Refund reconciliation joins pending intents to their immutable originating attempt.
CREATE INDEX refunds_payment_attempt_created_idx ON seven.refunds(payment_attempt_id,created_at);
