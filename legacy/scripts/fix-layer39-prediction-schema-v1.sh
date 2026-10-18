#!/bin/bash
set -e

echo "=== Fixing Layer 39 Prediction Schema For Layer 40 ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_predictions

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS prediction_type TEXT,

ADD COLUMN IF NOT EXISTS input_state JSONB,

ADD COLUMN IF NOT EXISTS prediction JSONB,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



ALTER TABLE food_brain_prediction_accuracy

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS prediction_id INTEGER,

ADD COLUMN IF NOT EXISTS expected JSONB,

ADD COLUMN IF NOT EXISTS actual JSONB,

ADD COLUMN IF NOT EXISTS accuracy_score NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_prediction_fixed_asset
ON food_brain_predictions(asset_id);



CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_fixed_asset
ON food_brain_prediction_accuracy(asset_id);



SQL


echo "=== Prediction schema repaired ==="

