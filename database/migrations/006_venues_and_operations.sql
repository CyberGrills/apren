-- New local platform: small venue tables; defaults backfill revision/activity without rewriting history.
ALTER TABLE seven.venues ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE seven.venues ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE seven.notifications ADD COLUMN href varchar(500) NOT NULL DEFAULT '/app/bookings';
COMMENT ON COLUMN seven.notifications.href IS 'Internal action-specific destination, never an untrusted external URL.';
COMMENT ON COLUMN seven.venues.revision IS 'Optimistic edit revision; existing reservations retain their quote snapshots.';
COMMENT ON COLUMN seven.venues.is_active IS 'Only an empty unused venue can be archived; retained records are not deleted.';
CREATE TABLE seven.payment_note_methods (
 payment_note_method_id bigint GENERATED ALWAYS AS IDENTITY,
 method_code varchar(30) NOT NULL, is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT payment_note_methods_pk PRIMARY KEY(payment_note_method_id),CONSTRAINT payment_note_methods_code_uk UNIQUE(method_code)
);
ALTER TABLE seven.payment_note_methods OWNER TO seven_owner;
GRANT SELECT ON seven.payment_note_methods TO seven_app,seven_readonly;
COMMENT ON TABLE seven.payment_note_methods IS 'Classifies staff-reported external payment notes, which are not provider confirmations.';
INSERT INTO seven.payment_note_methods(method_code) VALUES('CASH'),('BANK_TRANSFER'),('EXTERNAL_POS') ON CONFLICT(method_code) DO NOTHING;
CREATE TABLE seven.payment_notes (
 payment_note_id uuid NOT NULL,
 reservation_id uuid NOT NULL,user_id uuid NOT NULL,payment_note_method_id bigint NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),payment_reference varchar(120) NOT NULL DEFAULT '',note_body varchar(500) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT payment_notes_pk PRIMARY KEY(payment_note_id),
 CONSTRAINT payment_notes_reservation_fk FOREIGN KEY(reservation_id) REFERENCES seven.reservations(reservation_id) ON DELETE RESTRICT,
 CONSTRAINT payment_notes_user_fk FOREIGN KEY(user_id) REFERENCES seven.users(user_id) ON DELETE RESTRICT,
 CONSTRAINT payment_notes_method_fk FOREIGN KEY(payment_note_method_id) REFERENCES seven.payment_note_methods(payment_note_method_id) ON DELETE RESTRICT
);
ALTER TABLE seven.payment_notes OWNER TO seven_owner;
GRANT SELECT,INSERT ON seven.payment_notes TO seven_app;
GRANT SELECT ON seven.payment_notes TO seven_readonly;
COMMENT ON TABLE seven.payment_notes IS 'Append-only reception assertions about payments made outside checkout. Never change provider status, money journals, or points.';
COMMENT ON COLUMN seven.payment_notes.amount_minor IS 'Staff-reported NGN kobo amount, not evidence of provider receipt.';
CREATE INDEX payment_notes_reservation_created_idx ON seven.payment_notes(reservation_id,created_at);
CREATE TRIGGER payment_notes_immutable BEFORE UPDATE OR DELETE ON seven.payment_notes FOR EACH ROW EXECUTE FUNCTION seven.prevent_journal_mutation();
