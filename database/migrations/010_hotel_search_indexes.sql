-- Search indexes for nationwide hotel discovery.
-- Keep the predicates aligned with the public-offering and available-inventory filters.
CREATE INDEX IF NOT EXISTS offerings_public_sector_created_idx
  ON seven.offerings (sector_id, created_at DESC, offering_id)
  WHERE is_published;

CREATE INDEX IF NOT EXISTS offerings_public_city_created_idx
  ON seven.offerings (lower(city), created_at DESC, offering_id)
  WHERE is_published;

CREATE INDEX IF NOT EXISTS businesses_workflow_business_idx
  ON seven.businesses (workflow_state_id, business_id);

CREATE INDEX IF NOT EXISTS inventory_windows_available_offer_dates_idx
  ON seven.inventory_windows (offering_id, starts_at, ends_at)
  WHERE capacity > allocated_count;
