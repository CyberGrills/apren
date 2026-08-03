#!/bin/bash
set -e

echo "=== āprən Layer 20 Orchestration Schema Repair ==="

cd ~/apren


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_orchestration_runs

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS stage TEXT,

ADD COLUMN IF NOT EXISTS input_signals JSONB,

ADD COLUMN IF NOT EXISTS decision_output JSONB,

ADD COLUMN IF NOT EXISTS execution_output JSONB,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_orchestration_asset
ON food_brain_orchestration_runs(asset_id);




ALTER TABLE food_brain_learning_feedback

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS source_stage TEXT,

ADD COLUMN IF NOT EXISTS feedback_type TEXT,

ADD COLUMN IF NOT EXISTS feedback_data JSONB,

ADD COLUMN IF NOT EXISTS learning_score NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_learning_feedback_asset
ON food_brain_learning_feedback(asset_id);



\d food_brain_learning_feedback


SQL


echo

echo "=== Layer 20 schema repair complete ==="

