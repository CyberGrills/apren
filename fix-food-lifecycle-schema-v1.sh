#!/bin/bash
set -e

echo "=== āprən Lifecycle Schema Repair v1 ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_asset_lifecycle
ADD COLUMN IF NOT EXISTS state TEXT;


ALTER TABLE food_asset_lifecycle
ADD COLUMN IF NOT EXISTS previous_state TEXT;


ALTER TABLE food_asset_lifecycle
ADD COLUMN IF NOT EXISTS freshness_score NUMERIC(5,2);


ALTER TABLE food_asset_lifecycle
ADD COLUMN IF NOT EXISTS market_value NUMERIC(12,2);


ALTER TABLE food_asset_lifecycle
ADD COLUMN IF NOT EXISTS reason TEXT;



UPDATE food_asset_lifecycle
SET state='UNKNOWN'
WHERE state IS NULL;



CREATE INDEX IF NOT EXISTS idx_food_asset_lifecycle_asset
ON food_asset_lifecycle(asset_id);



SQL


echo
echo "=== Verify lifecycle columns ==="


docker exec apren-postgres psql \
-U apren \
-d apren \
-c "
SELECT column_name,data_type
FROM information_schema.columns
WHERE table_name='food_asset_lifecycle'
ORDER BY ordinal_position;
"


echo
echo "=== COMPLETE ==="

