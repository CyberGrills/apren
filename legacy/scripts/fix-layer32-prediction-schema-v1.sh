#!/bin/bash
set -e

echo "=== Fixing Layer 32 Prediction Schema ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_predictions

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS prediction_type TEXT,

ADD COLUMN IF NOT EXISTS prediction TEXT,

ADD COLUMN IF NOT EXISTS recommended_action TEXT,

ADD COLUMN IF NOT EXISTS reasoning JSONB,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



ALTER TABLE food_brain_prediction_history

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS prediction_id INTEGER,

ADD COLUMN IF NOT EXISTS actual_result JSONB,

ADD COLUMN IF NOT EXISTS accuracy_score NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_prediction_reasoning_asset
ON food_brain_predictions(asset_id);



CREATE INDEX IF NOT EXISTS idx_prediction_history_fixed_asset
ON food_brain_prediction_history(asset_id);



SQL


echo "=== Layer 32 schema repaired ==="

