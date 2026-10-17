#!/bin/bash
set -e

echo "=== Fix Food Brain Layer 7 Governor Schema ==="

cd ~/apren


mkdir -p backups/layer7-governor-schema-fix


docker exec apren-postgres pg_dump \
-U apren \
-d apren \
-t food_brain_governor_decisions \
> backups/layer7-governor-schema-fix/governor-table-backup.sql



docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


ALTER TABLE food_brain_governor_decisions
ADD COLUMN IF NOT EXISTS risk TEXT;


ALTER TABLE food_brain_governor_decisions
ADD COLUMN IF NOT EXISTS trust TEXT;


ALTER TABLE food_brain_governor_decisions
ADD COLUMN IF NOT EXISTS economic_status TEXT;


ALTER TABLE food_brain_governor_decisions
ADD COLUMN IF NOT EXISTS decision TEXT;


ALTER TABLE food_brain_governor_decisions
ADD COLUMN IF NOT EXISTS signals JSONB;



SQL


echo "=== Verify columns ==="


docker exec apren-postgres psql \
-U apren \
-d apren \
-c "\d food_brain_governor_decisions"


echo "=== COMPLETE ==="

