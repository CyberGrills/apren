-- Manual request-to-book path for stays without connected live inventory.
-- This table is intentionally separate from quotes, reservations, allocations and payments.
CREATE TABLE seven.stay_booking_requests (
  request_id uuid PRIMARY KEY,
  request_reference varchar(24) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES seven.businesses(business_id) ON DELETE RESTRICT,
  offering_id uuid NOT NULL REFERENCES seven.offerings(offering_id) ON DELETE RESTRICT,
  check_in date NOT NULL,
  check_out date NOT NULL,
  room_count integer NOT NULL CHECK (room_count BETWEEN 1 AND 20),
  guest_name varchar(100) NOT NULL,
  guest_email varchar(254) NOT NULL,
  guest_phone varchar(30) NOT NULL,
  guest_message varchar(1000) NOT NULL DEFAULT '',
  quoted_rate_minor bigint CHECK (quoted_rate_minor IS NULL OR quoted_rate_minor >= 0),
  currency_code varchar(3) NOT NULL DEFAULT 'NGN' CHECK (currency_code='NGN'),
  status varchar(16) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','ACCEPTED','DECLINED','CANCELLED','EXPIRED')),
  payment_status varchar(12) NOT NULL DEFAULT 'UNPAID'
    CHECK (payment_status='UNPAID'),
  property_response varchar(1000) NOT NULL DEFAULT '',
  idempotency_key varchar(200) NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  responded_by uuid REFERENCES seven.users(user_id) ON DELETE RESTRICT,
  responded_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_booking_requests_dates_ck CHECK (check_out > check_in),
  CONSTRAINT stay_booking_requests_guest_name_ck CHECK (char_length(btrim(guest_name)) BETWEEN 2 AND 100),
  CONSTRAINT stay_booking_requests_guest_email_ck CHECK (guest_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT stay_booking_requests_guest_phone_ck CHECK (char_length(btrim(guest_phone)) BETWEEN 7 AND 30),
  CONSTRAINT stay_booking_requests_user_key_uk UNIQUE(user_id,idempotency_key)
);
CREATE INDEX stay_booking_requests_business_status_idx
  ON seven.stay_booking_requests(business_id,status,created_at DESC);
CREATE INDEX stay_booking_requests_customer_idx
  ON seven.stay_booking_requests(user_id,created_at DESC);
ALTER TABLE seven.stay_booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY seven_app_server_access ON seven.stay_booking_requests
  FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_select_access ON seven.stay_booking_requests
  FOR SELECT TO seven_readonly USING (false);
ALTER TABLE seven.stay_booking_requests OWNER TO seven_owner;
GRANT SELECT,INSERT,UPDATE,DELETE ON seven.stay_booking_requests TO seven_app;
GRANT SELECT ON seven.stay_booking_requests TO seven_readonly;
COMMENT ON TABLE seven.stay_booking_requests IS
  'Manual stay enquiries for properties without live inventory. Never allocates rooms, creates a reservation, or records payment.';
