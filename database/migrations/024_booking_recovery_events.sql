-- Booking recovery telemetry for the first safe 7even pilot.
-- Stores pseudonymous event IDs only; never store guest names, phone numbers,
-- emails, payment credentials, or raw user-agent/IP values in this table.
CREATE TABLE seven.booking_recovery_events (
  recovery_event_id uuid NOT NULL,
  event_id uuid NOT NULL,
  session_id uuid NOT NULL,
  offering_id uuid NOT NULL REFERENCES seven.offerings(offering_id) ON DELETE RESTRICT,
  event_code varchar(32) NOT NULL CHECK (event_code IN (
    'SEARCH','ROOM_VIEW','BOOKING_START','CHECKOUT_VIEW','ABANDON',
    'PAYMENT_FAILED','BOOKING_CONFIRMED','CANCELLED'
  )),
  reason_code varchar(24) CHECK (reason_code IS NULL OR reason_code IN (
    'PRICE','DATES','POLICY','PAYMENT','QUESTION','UNKNOWN'
  )),
  amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  contact_channel varchar(16) NOT NULL DEFAULT 'NONE'
    CHECK (contact_channel IN ('NONE','WHATSAPP','EMAIL')),
  contact_consent boolean NOT NULL DEFAULT false,
  consent_text_version varchar(80),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_recovery_events_pk PRIMARY KEY (recovery_event_id),
  CONSTRAINT booking_recovery_events_event_id_uk UNIQUE (event_id),
  CONSTRAINT booking_recovery_events_consent_ck CHECK (
    (contact_consent = false AND contact_channel = 'NONE')
    OR (contact_consent = true AND contact_channel IN ('WHATSAPP','EMAIL')
        AND consent_text_version IS NOT NULL)
  ),
  CONSTRAINT booking_recovery_events_details_object_ck CHECK (jsonb_typeof(details) = 'object')
);
ALTER TABLE seven.booking_recovery_events OWNER TO seven_owner;
GRANT SELECT, INSERT ON seven.booking_recovery_events TO seven_app;
GRANT SELECT ON seven.booking_recovery_events TO seven_readonly;
CREATE INDEX booking_recovery_events_session_idx
  ON seven.booking_recovery_events(session_id, occurred_at);
CREATE INDEX booking_recovery_events_offering_time_idx
  ON seven.booking_recovery_events(offering_id, occurred_at DESC);
COMMENT ON TABLE seven.booking_recovery_events IS
  'Pseudonymous booking-funnel telemetry for the 7even recovery pilot. This table does not authorize outbound messaging; consent evidence and approved provider templates are required separately.';
