-- Structured hotel room inventory and nightly rate foundation.
-- Existing offerings remain the public room-category listing and inventory_windows
-- remain the authoritative capacity/allocation counter. This migration adds no
-- second stock counter and does not create reservations or payments.

CREATE TABLE seven.stay_room_types (
  room_type_id uuid PRIMARY KEY,
  offering_id uuid NOT NULL UNIQUE REFERENCES seven.offerings(offering_id) ON DELETE RESTRICT,
  max_occupancy integer NOT NULL CHECK (max_occupancy BETWEEN 1 AND 30),
  bed_configuration varchar(180) NOT NULL DEFAULT '',
  total_rooms integer CHECK (total_rooms IS NULL OR total_rooms BETWEEN 1 AND 10000),
  is_active boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_room_types_room_offering_uk UNIQUE (room_type_id, offering_id)
);

CREATE TABLE seven.stay_rate_plans (
  rate_plan_id uuid PRIMARY KEY,
  room_type_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  code varchar(40) NOT NULL,
  name varchar(120) NOT NULL,
  currency_code varchar(3) NOT NULL DEFAULT 'NGN'
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  meal_plan varchar(40) NOT NULL DEFAULT 'ROOM_ONLY',
  refundable boolean,
  cancellation_policy text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_rate_plans_room_fk
    FOREIGN KEY (room_type_id, offering_id)
    REFERENCES seven.stay_room_types(room_type_id, offering_id) ON DELETE RESTRICT,
  CONSTRAINT stay_rate_plans_code_ck CHECK (code ~ '^[A-Z0-9_-]{2,40}$'),
  CONSTRAINT stay_rate_plans_name_ck CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  CONSTRAINT stay_rate_plans_room_code_uk UNIQUE (room_type_id, code),
  CONSTRAINT stay_rate_plans_plan_room_uk UNIQUE (rate_plan_id, room_type_id)
);

CREATE TABLE seven.stay_nightly_rates (
  rate_plan_id uuid NOT NULL,
  room_type_id uuid NOT NULL,
  service_date date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  closed_to_arrival boolean NOT NULL DEFAULT false,
  closed_to_departure boolean NOT NULL DEFAULT false,
  min_stay_nights integer CHECK (min_stay_nights IS NULL OR min_stay_nights BETWEEN 1 AND 365),
  max_stay_nights integer CHECK (max_stay_nights IS NULL OR max_stay_nights BETWEEN 1 AND 365),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_nightly_rates_plan_room_fk
    FOREIGN KEY (rate_plan_id, room_type_id)
    REFERENCES seven.stay_rate_plans(rate_plan_id, room_type_id) ON DELETE RESTRICT,
  CONSTRAINT stay_nightly_rates_date_uk UNIQUE (rate_plan_id, service_date),
  CONSTRAINT stay_nightly_rates_stay_bounds_ck
    CHECK (min_stay_nights IS NULL OR max_stay_nights IS NULL OR min_stay_nights <= max_stay_nights),
  CONSTRAINT stay_nightly_rates_pk PRIMARY KEY (rate_plan_id, service_date)
);

CREATE INDEX stay_room_types_active_idx
  ON seven.stay_room_types (offering_id, is_active);
CREATE INDEX stay_rate_plans_active_idx
  ON seven.stay_rate_plans (room_type_id, is_active);
CREATE INDEX stay_nightly_rates_date_idx
  ON seven.stay_nightly_rates (service_date, rate_plan_id);

ALTER TABLE seven.stay_room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE seven.stay_rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE seven.stay_nightly_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY seven_app_server_access ON seven.stay_room_types
  FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_select_access ON seven.stay_room_types
  FOR SELECT TO seven_readonly USING (false);

CREATE POLICY seven_app_server_access ON seven.stay_rate_plans
  FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_select_access ON seven.stay_rate_plans
  FOR SELECT TO seven_readonly USING (false);

CREATE POLICY seven_app_server_access ON seven.stay_nightly_rates
  FOR ALL TO seven_app USING (true) WITH CHECK (true);
CREATE POLICY seven_readonly_select_access ON seven.stay_nightly_rates
  FOR SELECT TO seven_readonly USING (false);

ALTER TABLE seven.stay_room_types OWNER TO seven_owner;
ALTER TABLE seven.stay_rate_plans OWNER TO seven_owner;
ALTER TABLE seven.stay_nightly_rates OWNER TO seven_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON seven.stay_room_types TO seven_app;
GRANT SELECT ON seven.stay_room_types TO seven_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.stay_rate_plans TO seven_app;
GRANT SELECT ON seven.stay_rate_plans TO seven_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.stay_nightly_rates TO seven_app;
GRANT SELECT ON seven.stay_nightly_rates TO seven_readonly;

COMMENT ON TABLE seven.stay_room_types IS
  'Structured room facts for one existing STAY offering; the offering remains the public listing.';
COMMENT ON TABLE seven.stay_rate_plans IS
  'Hotel rate plans attached to a room type, with explicit commercial and cancellation terms.';
COMMENT ON TABLE seven.stay_nightly_rates IS
  'Exact integer-minor-unit nightly prices and arrival/departure restrictions; missing dates have no implied price.';
