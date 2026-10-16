CREATE TABLE IF NOT EXISTS hospitality_properties (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  property_type TEXT NOT NULL CHECK (
    property_type IN ('hotel', 'guesthouse', 'restaurant', 'venue', 'short_stay', 'other')
  ),
  description TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  country_code CHAR(2) NOT NULL DEFAULT 'NG',
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitality_properties_owner
  ON hospitality_properties(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_hospitality_properties_status
  ON hospitality_properties(status);

CREATE TABLE IF NOT EXISTS hospitality_property_memberships (
  property_id BIGINT NOT NULL REFERENCES hospitality_properties(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (property_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hospitality_memberships_user
  ON hospitality_property_memberships(user_id, property_id);

CREATE TABLE IF NOT EXISTS hospitality_resources (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES hospitality_properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  resource_type TEXT NOT NULL CHECK (
    resource_type IN ('room', 'table', 'venue', 'service', 'unit')
  ),
  description TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  inventory_count INTEGER NOT NULL DEFAULT 1 CHECK (inventory_count > 0),
  price_minor BIGINT NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_hospitality_resources_property
  ON hospitality_resources(property_id, status, resource_type);

CREATE TABLE IF NOT EXISTS hospitality_reservations (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES hospitality_properties(id),
  resource_id BIGINT NOT NULL,
  guest_user_id INTEGER NOT NULL REFERENCES users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  guest_count INTEGER NOT NULL DEFAULT 1 CHECK (guest_count > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  price_minor BIGINT NOT NULL CHECK (price_minor >= 0),
  currency CHAR(3) NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (
    length(idempotency_key) BETWEEN 8 AND 200
  ),
  guest_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  FOREIGN KEY (resource_id, property_id)
    REFERENCES hospitality_resources(id, property_id),
  UNIQUE (guest_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_hospitality_reservations_resource_dates
  ON hospitality_reservations(resource_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_hospitality_reservations_guest
  ON hospitality_reservations(guest_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hospitality_reservations_property_status
  ON hospitality_reservations(property_id, status, starts_at);

CREATE TABLE IF NOT EXISTS hospitality_reservation_events (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL
    REFERENCES hospitality_reservations(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id),
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitality_reservation_events_reservation
  ON hospitality_reservation_events(reservation_id, created_at);
