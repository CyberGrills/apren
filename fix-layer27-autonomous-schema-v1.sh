#!/bin/bash
set -e

echo "=== Fixing Layer 27 Autonomous Schema ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_action_plans

ADD COLUMN IF NOT EXISTS priority NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS reasoning JSONB,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT TRUE;



ALTER TABLE food_brain_execution_results

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS plan_id INTEGER,

ADD COLUMN IF NOT EXISTS execution JSONB,

ADD COLUMN IF NOT EXISTS status TEXT,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_action_plan_priority
ON food_brain_action_plans(priority);



CREATE INDEX IF NOT EXISTS idx_execution_result_asset
ON food_brain_execution_results(asset_id);



SQL


echo "=== Layer 27 schema repaired ==="

