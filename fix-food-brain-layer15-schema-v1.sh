#!/bin/bash
set -e

echo "=== āprən Layer 15 Prediction Schema Repair ==="

cd ~/apren


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_predictions

ADD COLUMN IF NOT EXISTS prediction_type TEXT,

ADD COLUMN IF NOT EXISTS current_value NUMERIC,

ADD COLUMN IF NOT EXISTS predicted_value NUMERIC,

ADD COLUMN IF NOT EXISTS freshness_prediction NUMERIC,

ADD COLUMN IF NOT EXISTS confidence NUMERIC,

ADD COLUMN IF NOT EXISTS recommended_action TEXT,

ADD COLUMN IF NOT EXISTS reason TEXT,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_prediction_asset
ON food_brain_predictions(asset_id);



\d food_brain_predictions


SQL


echo

echo "=== Schema repair complete ==="

