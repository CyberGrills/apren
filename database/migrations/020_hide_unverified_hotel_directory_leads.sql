-- Keep unverified hotel-directory leads out of every public and application read path.
-- Verified, bookable stays must be published through the canonical offerings/inventory flow.
UPDATE seven.discovery_listings
SET listing_status = 'HIDDEN',
    updated_at = now()
WHERE kind = 'STAY'
  AND listing_status = 'DIRECTORY_ONLY';

DROP POLICY IF EXISTS discovery_listings_public_directory_read ON seven.discovery_listings;
CREATE POLICY discovery_listings_public_directory_read
  ON seven.discovery_listings
  FOR SELECT TO anon, authenticated
  USING (kind <> 'STAY' AND listing_status = 'DIRECTORY_ONLY' AND is_bookable = false);

DROP POLICY IF EXISTS seven_app_server_access ON seven.discovery_listings;
CREATE POLICY seven_app_server_access
  ON seven.discovery_listings
  FOR SELECT TO seven_app
  USING (kind <> 'STAY' AND listing_status = 'DIRECTORY_ONLY' AND is_bookable = false);

DROP POLICY IF EXISTS seven_readonly_select_access ON seven.discovery_listings;
CREATE POLICY seven_readonly_select_access
  ON seven.discovery_listings
  FOR SELECT TO seven_readonly
  USING (kind <> 'STAY' AND listing_status = 'DIRECTORY_ONLY' AND is_bookable = false);

CREATE OR REPLACE VIEW public.seven_discovery_directory
WITH (security_invoker = true)
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
WHERE kind <> 'STAY'
  AND listing_status = 'DIRECTORY_ONLY'
  AND is_bookable = false;

COMMENT ON VIEW public.seven_discovery_directory IS
  'Non-hotel discovery leads only. Unverified hotel leads are hidden; bookable stays must come from verified offerings and fresh inventory.';
