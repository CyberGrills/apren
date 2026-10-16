ALTER TABLE hospitality_resources
  ADD COLUMN IF NOT EXISTS pricing_unit TEXT NOT NULL DEFAULT 'per_night'
  CHECK (pricing_unit IN ('per_night', 'per_booking', 'per_person'));

ALTER TABLE hospitality_reservations
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ NOT NULL
    DEFAULT (NOW() + INTERVAL '15 minutes'),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hospitality_reservations_hold_expiry
  ON hospitality_reservations(status, hold_expires_at);

CREATE TABLE IF NOT EXISTS hospitality_arrival_intents (
  id BIGSERIAL PRIMARY KEY,
  origin_type TEXT NOT NULL CHECK (origin_type IN ('airport', 'bus_terminal', 'in_uyo', 'other')),
  origin_label TEXT NOT NULL CHECK (length(trim(origin_label)) BETWEEN 2 AND 180),
  city TEXT NOT NULL DEFAULT 'Uyo',
  need TEXT NOT NULL DEFAULT 'hotel_now'
    CHECK (need IN ('hotel_now', 'hotel_later', 'transport', 'food', 'full_arrival')),
  budget_minor BIGINT CHECK (budget_minor IS NULL OR budget_minor >= 0),
  guest_count INTEGER NOT NULL DEFAULT 1 CHECK (guest_count BETWEEN 1 AND 20),
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (check_out IS NULL OR check_in IS NULL OR check_out > check_in)
);
CREATE INDEX IF NOT EXISTS idx_hospitality_arrival_intents_city_created
  ON hospitality_arrival_intents(city, created_at DESC);

CREATE TABLE IF NOT EXISTS hospitality_payments (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES hospitality_reservations(id),
  guest_user_id INTEGER NOT NULL REFERENCES users(id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('paystack', 'cash_at_property', 'manual')),
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  checkout_url TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hospitality_payments_reservation
  ON hospitality_payments(reservation_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitality_payments_provider_reference
  ON hospitality_payments(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;
