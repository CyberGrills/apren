-- Venue-level amenities and facilities, separate from purchasable offerings.
-- A facility describes what a property has; a paid/bookable service remains an offering.
-- The composite venue FK prevents a business from attaching amenities to another tenant's venue.
ALTER TABLE seven.venues
  ADD CONSTRAINT venues_venue_business_unique UNIQUE (venue_id, business_id);

CREATE TABLE seven.venue_amenities (
  amenity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES seven.businesses(business_id) ON DELETE CASCADE,
  venue_id uuid NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SEASONAL', 'CLOSED')),
  access_type text NOT NULL DEFAULT 'INCLUDED'
    CHECK (access_type IN ('INCLUDED', 'PAID')),
  booking_required boolean NOT NULL DEFAULT false,
  opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(opening_hours) = 'object'),
  guest_notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_amenities_venue_business_fk
    FOREIGN KEY (venue_id, business_id)
    REFERENCES seven.venues (venue_id, business_id) ON DELETE CASCADE,
  CONSTRAINT venue_amenities_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  CONSTRAINT venue_amenities_description_length CHECK (char_length(description) <= 1200),
  CONSTRAINT venue_amenities_notes_length CHECK (char_length(guest_notes) <= 1200)
);

CREATE INDEX venue_amenities_public_listing_idx
  ON seven.venue_amenities (venue_id, status, sort_order, name)
  WHERE status IN ('ACTIVE', 'SEASONAL');

CREATE INDEX venue_amenities_business_management_idx
  ON seven.venue_amenities (business_id, venue_id, updated_at DESC);

COMMENT ON TABLE seven.venue_amenities IS
  'Owner-managed facilities attached to a venue. Paid/bookable services must be represented by seven.offerings and inventory, not by amenity rows.';
COMMENT ON COLUMN seven.venue_amenities.access_type IS
  'INCLUDED means included for eligible guests; PAID means a separately priced service must be configured as an offering before it can be sold.';
COMMENT ON COLUMN seven.venue_amenities.opening_hours IS
  'Owner-maintained local opening schedule as a JSON object; empty means hours have not been supplied and must not be displayed as 24/7.';

ALTER TABLE seven.venue_amenities OWNER TO seven_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON seven.venue_amenities TO seven_app;
GRANT SELECT ON seven.venue_amenities TO seven_readonly;
