-- Preserve all local sample activity while excluding it from market-demand evidence.
-- The sample-business flag is created only by the explicit development seed.
UPDATE seven.observations AS observation
SET is_synthetic=true,updated_at=now()
FROM seven.businesses AS business
WHERE business.business_id=observation.business_id
  AND business.details->>'isSample'='true'
  AND NOT observation.is_synthetic;
