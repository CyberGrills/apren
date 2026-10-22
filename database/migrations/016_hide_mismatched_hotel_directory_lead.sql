-- Hide a directory lead whose image/source association could misidentify the property.
UPDATE seven.discovery_listings
SET listing_status='HIDDEN', updated_at=now()
WHERE kind='STAY'
  AND display_name='Hotel Ibis Lagos Ikeja'
  AND listing_status='DIRECTORY_ONLY';
