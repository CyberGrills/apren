-- Durable audit of deterministic revenue recommendations computed in shadow mode.
-- This table is append-only from the consumer; it never authorizes commercial execution.
CREATE TABLE seven.booking_recovery_shadow_decisions (
  recovery_event_id uuid NOT NULL REFERENCES seven.booking_recovery_events(recovery_event_id) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  action_code varchar(48) NOT NULL,
  requires_human_approval boolean NOT NULL,
  may_contact_guest boolean NOT NULL DEFAULT false CHECK (may_contact_guest = false),
  policy_version varchar(80) NOT NULL,
  decision_payload jsonb NOT NULL CHECK (jsonb_typeof(decision_payload) = 'object'),
  execution_mode varchar(16) NOT NULL DEFAULT 'SHADOW' CHECK (execution_mode = 'SHADOW'),
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_recovery_shadow_decisions_pk PRIMARY KEY (recovery_event_id),
  CONSTRAINT booking_recovery_shadow_decisions_event_uk UNIQUE (event_id)
);
ALTER TABLE seven.booking_recovery_shadow_decisions OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.booking_recovery_shadow_decisions TO seven_app;
GRANT SELECT ON seven.booking_recovery_shadow_decisions TO seven_readonly;
ALTER TABLE seven.booking_recovery_shadow_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access
  ON seven.booking_recovery_shadow_decisions FOR ALL TO seven_app
  USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_select_access
  ON seven.booking_recovery_shadow_decisions FOR SELECT TO seven_readonly
  USING (true);
CREATE INDEX booking_recovery_shadow_decisions_decided_idx
  ON seven.booking_recovery_shadow_decisions(decided_at DESC);
COMMENT ON TABLE seven.booking_recovery_shadow_decisions IS
  'Append-only, non-executable shadow decisions for pseudonymous booking recovery events. Guest contact is structurally disabled.';
