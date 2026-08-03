#!/bin/bash
set -e

echo "=== Fixing Layer 38 Simulation Schema ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_simulations

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS scenario TEXT,

ADD COLUMN IF NOT EXISTS inputs JSONB,

ADD COLUMN IF NOT EXISTS predicted_outcome JSONB,

ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



ALTER TABLE food_brain_simulation_results

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS selected_scenario TEXT,

ADD COLUMN IF NOT EXISTS reason JSONB,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_simulation_fixed_asset
ON food_brain_simulations(asset_id);



CREATE INDEX IF NOT EXISTS idx_simulation_results_fixed_asset
ON food_brain_simulation_results(asset_id);



SQL


echo "=== Layer 38 schema repaired ==="

