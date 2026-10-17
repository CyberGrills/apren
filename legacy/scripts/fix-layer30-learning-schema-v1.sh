#!/bin/bash
set -e

echo "=== Fixing Layer 30 Learning Feedback Schema ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_learning_feedback

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS previous_action TEXT,

ADD COLUMN IF NOT EXISTS result JSONB,

ADD COLUMN IF NOT EXISTS learning_score NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_learning_feedback_asset_fixed
ON food_brain_learning_feedback(asset_id);



SQL


echo "=== Layer 30 learning schema repaired ==="

