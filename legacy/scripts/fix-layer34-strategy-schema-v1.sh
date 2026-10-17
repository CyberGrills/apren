#!/bin/bash
set -e

echo "=== Fixing Layer 34 Strategy Schema ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_strategies

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS strategy_type TEXT,

ADD COLUMN IF NOT EXISTS strategy JSONB,

ADD COLUMN IF NOT EXISTS expected_result JSONB,

ADD COLUMN IF NOT EXISTS risk_score NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



ALTER TABLE food_brain_strategy_history

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS previous_strategy JSONB,

ADD COLUMN IF NOT EXISTS outcome JSONB,

ADD COLUMN IF NOT EXISTS success_score NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_strategy_fixed_asset
ON food_brain_strategies(asset_id);



CREATE INDEX IF NOT EXISTS idx_strategy_history_fixed_asset
ON food_brain_strategy_history(asset_id);


SQL


echo "=== Layer 34 schema repaired ==="

