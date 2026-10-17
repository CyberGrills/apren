#!/bin/bash
set -e

echo "=== āprən Atomic Transaction Ledger Migration v1 ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'

CREATE TABLE IF NOT EXISTS food_asset_events
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

event_type TEXT NOT NULL,

description TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS food_asset_ownership_history
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

owner_id INTEGER REFERENCES users(id),

action TEXT NOT NULL,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_food_asset_events_asset
ON food_asset_events(asset_id);


CREATE INDEX IF NOT EXISTS idx_food_asset_owner_history_asset
ON food_asset_ownership_history(asset_id);


SQL


echo
echo "=== verifying tables ==="


docker exec apren-postgres psql \
-U apren \
-d apren \
-c "
SELECT table_name
FROM information_schema.tables
WHERE table_name IN (
'food_asset_events',
'food_asset_ownership_history'
)
ORDER BY table_name;
"

echo
echo "=== migration complete ==="

