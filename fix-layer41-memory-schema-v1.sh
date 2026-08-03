#!/bin/bash
set -e

echo "=== Fixing Layer 41 Unified Memory Schema ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'

ALTER TABLE food_brain_memory

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS memory_type TEXT,

ADD COLUMN IF NOT EXISTS event JSONB,

ADD COLUMN IF NOT EXISTS decision JSONB,

ADD COLUMN IF NOT EXISTS outcome JSONB,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS importance NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



ALTER TABLE food_brain_experience_patterns

ADD COLUMN IF NOT EXISTS pattern JSONB,

ADD COLUMN IF NOT EXISTS successful_action TEXT,

ADD COLUMN IF NOT EXISTS success_rate NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_memory_importance
ON food_brain_memory(importance);



CREATE INDEX IF NOT EXISTS idx_memory_asset_history
ON food_brain_memory(asset_id);



SQL


echo "=== Layer 41 memory schema repaired ==="

