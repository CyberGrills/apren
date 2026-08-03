#!/bin/bash
set -e

echo "=== Killing old assets process ==="

PID=$(lsof -ti :4003 || true)

if [ -n "$PID" ]; then
    kill $PID
    sleep 2
fi


echo "=== Checking no old process ==="

lsof -i :4003 || true


echo "=== Starting fresh assets engine ==="

cd ~/apren/services/assets

nohup node src/server.js > service.log 2>&1 &

sleep 3


echo "=== New process ==="

lsof -i :4003


echo
echo "=== Testing route existence ==="

curl -i http://localhost:4003/economy/create


