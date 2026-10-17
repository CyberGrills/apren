#!/bin/bash

set -e

echo "Restarting āprən Asset Engine..."

pkill -f "node src/server.js" || true

sleep 2

echo "Starting Asset Engine..."

npm start
