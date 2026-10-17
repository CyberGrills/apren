-- Empty development tables at creation time. Add nullable links before backfill.
-- Membership venue is NULL only for whole-business ownership or deliberately whole-business reception.
ALTER TABLE seven.memberships ADD COLUMN venue_id uuid;
ALTER TABLE seven.memberships ADD CONSTRAINT memberships_venue_fk FOREIGN KEY(venue_id) REFERENCES seven.venues(venue_id) ON DELETE RESTRICT;
COMMENT ON COLUMN seven.memberships.venue_id IS 'Optional restricted venue for reception; owner membership is business-wide.';
ALTER TABLE seven.reservations ADD COLUMN funding_payment_attempt_id uuid;
ALTER TABLE seven.reservations ADD CONSTRAINT reservations_funding_payment_fk FOREIGN KEY(funding_payment_attempt_id) REFERENCES seven.payment_attempts(payment_attempt_id) ON DELETE RESTRICT;
COMMENT ON COLUMN seven.reservations.funding_payment_attempt_id IS 'Authoritative funding receipt; excess charges cannot replace the reservation payment.';
-- Guard account precision while retaining exact bigint storage. User row locks serialize customer effects.
CREATE FUNCTION seven.prevent_journal_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Journal records are immutable; append a compensating entry'; END $$;
ALTER FUNCTION seven.prevent_journal_mutation() OWNER TO seven_owner;
CREATE TRIGGER money_postings_immutable BEFORE UPDATE OR DELETE ON seven.money_postings FOR EACH ROW EXECUTE FUNCTION seven.prevent_journal_mutation();
CREATE TRIGGER money_journals_immutable BEFORE UPDATE OR DELETE ON seven.money_journals FOR EACH ROW EXECUTE FUNCTION seven.prevent_journal_mutation();
CREATE TRIGGER points_postings_immutable BEFORE UPDATE OR DELETE ON seven.points_postings FOR EACH ROW EXECUTE FUNCTION seven.prevent_journal_mutation();
CREATE TRIGGER points_journals_immutable BEFORE UPDATE OR DELETE ON seven.points_journals FOR EACH ROW EXECUTE FUNCTION seven.prevent_journal_mutation();
COMMENT ON FUNCTION seven.prevent_journal_mutation() IS 'Prevents historical correction through update/delete, including privileged runtime mistakes.';
