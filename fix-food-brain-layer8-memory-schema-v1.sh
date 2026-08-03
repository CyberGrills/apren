#!/bin/bash
set -e

echo "=== Fix Food Brain Layer 8 Memory Schema ==="

cd ~/apren


mkdir -p backups/layer8-memory-schema-fix


docker exec apren-postgres pg_dump \
-U apren \
-d apren \
-t food_brain_memory_nodes \
> backups/layer8-memory-schema-fix/memory_nodes_backup.sql



docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_memory_nodes
ADD COLUMN IF NOT EXISTS memory_type TEXT;


ALTER TABLE food_brain_memory_nodes
ADD COLUMN IF NOT EXISTS content JSONB;


CREATE INDEX IF NOT EXISTS idx_memory_asset
ON food_brain_memory_nodes(asset_id);


CREATE INDEX IF NOT EXISTS idx_memory_type
ON food_brain_memory_nodes(memory_type);



SQL



echo "=== Verify memory schema ==="


docker exec apren-postgres psql \
-U apren \
-d apren \
-c "\d food_brain_memory_nodes"



echo "=== COMPLETE ==="

