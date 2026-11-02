-- Public-safe projection of approved canonical business profiles.
-- This directory is deliberately separate from offerings and inventory:
-- every row remains non-bookable until the server-side eligibility contract passes.
-- The view exposes no owner IDs, phone numbers, payment details, verification evidence,
-- credentials, or raw business JSON.
CREATE OR REPLACE VIEW public.seven_business_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  b.business_id::text AS id,
  b.slug,
  b.business_name AS name,
  upper(b.details->>'sector') AS kind,
  NULLIF(b.details->>'state', '') AS state,
  b.city,
  venue.venue_name AS "venueName",
  NULLIF(venue.address_line, '') AS address,
  NULL::text AS description,
  NULL::text AS "imageUrl",
  CASE
    WHEN upper(b.details->>'sector') = 'STAY' THEN 'REVIEW_REQUIRED'
    ELSE 'NOT_APPLICABLE'
  END AS "verificationStatus",
  'APPROVED'::text AS "businessStatus",
  'DIRECTORY_ONLY'::text AS "listingStatus",
  false AS bookable,
  EXISTS (
    SELECT 1
    FROM seven.offerings o
    WHERE o.business_id = b.business_id
      AND o.is_published = true
  ) AS "hasPublishedOffering"
FROM seven.businesses b
JOIN seven.workflow_states ws USING (workflow_state_id)
LEFT JOIN LATERAL (
  SELECT v.venue_name, v.address_line
  FROM seven.venues v
  WHERE v.business_id = b.business_id
    AND v.is_active = true
  ORDER BY v.created_at DESC, v.venue_id
  LIMIT 1
) venue ON true
WHERE ws.workflow_state_code = 'APPROVED'
  AND b.details->>'isSample' IS DISTINCT FROM 'true'
  AND upper(COALESCE(b.details->>'sector', '')) IN ('STAY', 'DINING', 'EXPERIENCE')
  AND venue.venue_name IS NOT NULL;

ALTER VIEW public.seven_business_directory OWNER TO postgres;
REVOKE ALL ON public.seven_business_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seven_business_directory TO anon, authenticated;

COMMENT ON VIEW public.seven_business_directory IS
  'Public-safe directory profiles for approved canonical businesses. This view never grants booking eligibility; current offerings and authoritative inventory are evaluated separately.';
