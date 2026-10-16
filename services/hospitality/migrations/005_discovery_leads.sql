CREATE TABLE IF NOT EXISTS hospitality_discovery_leads (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  property_type_guess TEXT NOT NULL DEFAULT 'hotel_or_accommodation',
  address TEXT,
  phone TEXT,
  source_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'verified', 'rejected', 'duplicate')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitality_discovery_leads_status
  ON hospitality_discovery_leads(status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_hospitality_discovery_leads_name_search
  ON hospitality_discovery_leads USING GIN (to_tsvector('simple', name));

COMMENT ON TABLE hospitality_discovery_leads IS
  'Unverified directory candidates only. Never expose as verified/bookable hospitality_properties without partner and inventory verification.';
