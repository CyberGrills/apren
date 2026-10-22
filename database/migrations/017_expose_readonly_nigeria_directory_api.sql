-- Safely expose only public, non-bookable directory read models through Supabase Data API.
-- Identity, bookings, payments, inventory, partners and refunds remain unexposed.

GRANT USAGE ON SCHEMA seven TO anon, authenticated;
GRANT SELECT ON seven.discovery_listings, seven.state_directories TO anon, authenticated;

DROP POLICY IF EXISTS discovery_listings_public_directory_read ON seven.discovery_listings;
CREATE POLICY discovery_listings_public_directory_read
  ON seven.discovery_listings
  FOR SELECT TO anon, authenticated
  USING (listing_status='DIRECTORY_ONLY' AND is_bookable=false);

DROP POLICY IF EXISTS state_directories_public_read ON seven.state_directories;
CREATE POLICY state_directories_public_read
  ON seven.state_directories
  FOR SELECT TO anon, authenticated
  USING (is_active=true);

CREATE OR REPLACE VIEW public.seven_discovery_directory
WITH (security_invoker=true)
AS
SELECT discovery_listing_id::text AS id,
       kind,
       display_name AS name,
       state_name AS state,
       city,
       area,
       address_text AS address,
       description,
       image_url AS "imageUrl",
       image_source_url AS "imageSourceUrl",
       source_name AS "sourceName",
       source_url AS "sourceUrl",
       'DIRECTORY_ONLY'::text AS status,
       false AS bookable,
       source_checked_at AS "sourceCheckedAt"
FROM seven.discovery_listings
WHERE listing_status='DIRECTORY_ONLY' AND is_bookable=false;

CREATE OR REPLACE VIEW public.seven_state_directories
WITH (security_invoker=true)
AS
SELECT state_name AS "stateName",
       capital,
       region,
       hotel_directory_url AS "hotelDirectoryUrl"
FROM seven.state_directories
WHERE is_active=true;

REVOKE ALL ON public.seven_discovery_directory FROM PUBLIC;
REVOKE ALL ON public.seven_state_directories FROM PUBLIC;
GRANT SELECT ON public.seven_discovery_directory TO anon, authenticated;
GRANT SELECT ON public.seven_state_directories TO anon, authenticated;
