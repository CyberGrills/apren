#!/bin/bash
set -e

echo "=== Fixing Layer 37 Agent Collaboration Schema ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_agents

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS agent_name TEXT,

ADD COLUMN IF NOT EXISTS signal TEXT,

ADD COLUMN IF NOT EXISTS recommendation TEXT,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



ALTER TABLE food_brain_agent_decisions

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS participating_agents JSONB,

ADD COLUMN IF NOT EXISTS final_decision TEXT,

ADD COLUMN IF NOT EXISTS consensus_score NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_agents_fixed_asset
ON food_brain_agents(asset_id);



CREATE INDEX IF NOT EXISTS idx_agent_decisions_fixed_asset
ON food_brain_agent_decisions(asset_id);



SQL


echo "=== Layer 37 schema repaired ==="

