#!/bin/bash
set -e

echo "=== Fixing Food Brain Agent Memory Constraint ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_agents
DROP CONSTRAINT IF EXISTS food_brain_agents_agent_name_key;



CREATE INDEX IF NOT EXISTS idx_agents_name_history
ON food_brain_agents(agent_name);



CREATE INDEX IF NOT EXISTS idx_agents_asset_history
ON food_brain_agents(asset_id);



SQL


echo "=== Agent memory constraint repaired ==="

