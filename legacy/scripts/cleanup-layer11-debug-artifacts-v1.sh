#!/bin/bash
set -e

echo "=== āprən Layer 11 Debug Artifact Cleanup ==="

cd ~/apren


echo "=== Creating archive location ==="

mkdir -p debug/archive/layer11


echo "=== Moving debug scripts ==="

for file in \
debug-express-routes-v1.sh \
debug-express-routes-v2.sh \
fix-food-brain-layer11-authority-route-v2.sh \
fix-food-brain-layer11-route-placement-v3.sh \
fix-food-brain-layer11-route-registration-v1.sh
do

if [ -f "$file" ]; then
    mv "$file" debug/archive/layer11/
fi

done


echo "=== Moving temporary server backups ==="

for file in \
services/assets/src/server.js.debug-backup \
services/assets/src/server.js.debug-v2-backup
do

if [ -f "$file" ]; then
    mv "$file" debug/archive/layer11/
fi

done


echo "=== Verify ==="

echo "Production root debug files:"
ls debug/archive/layer11


echo

echo "Checking server syntax:"
node --check services/assets/src/server.js


echo

echo "=== Cleanup Complete ==="

