#!/bin/bash
set -e

echo "=== āprən Layer 18 Decision Schema Repair ==="

cd ~/apren


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_decisions

ADD COLUMN IF NOT EXISTS action TEXT,

ADD COLUMN IF NOT EXISTS reasoning JSONB,

ADD COLUMN IF NOT EXISTS signals JSONB,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS execution_mode TEXT DEFAULT 'ASSISTED',

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_brain_decisions_asset
ON food_brain_decisions(asset_id);



ALTER TABLE food_brain_action_scores

ADD COLUMN IF NOT EXISTS action TEXT,

ADD COLUMN IF NOT EXISTS score NUMERIC,

ADD COLUMN IF NOT EXISTS reason TEXT,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_action_scores_asset
ON food_brain_action_scores(asset_id);



\d food_brain_decisions


SQL


echo

echo "=== Layer 18 schema repair complete ==="

