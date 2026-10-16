ALTER TABLE hospitality_properties
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS coordinates_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS website_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitality_properties_verification_status_check') THEN
    ALTER TABLE hospitality_properties ADD CONSTRAINT hospitality_properties_verification_status_check
      CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitality_properties_latitude_range') THEN
    ALTER TABLE hospitality_properties ADD CONSTRAINT hospitality_properties_latitude_range
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitality_properties_longitude_range') THEN
    ALTER TABLE hospitality_properties ADD CONSTRAINT hospitality_properties_longitude_range
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitality_properties_coordinates_pair') THEN
    ALTER TABLE hospitality_properties ADD CONSTRAINT hospitality_properties_coordinates_pair
      CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitality_resources_pricing_unit_check') THEN
    ALTER TABLE hospitality_resources ADD CONSTRAINT hospitality_resources_pricing_unit_check
      CHECK (pricing_unit IN ('per_night', 'per_booking', 'per_person'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hospitality_properties_city_verification
  ON hospitality_properties(city, status, verification_status);
