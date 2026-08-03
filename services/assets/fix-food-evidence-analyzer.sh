#!/bin/bash

set -e

echo "Fixing āprən Food Evidence Analyzer table mapping..."

python3 - <<'PY'
from pathlib import Path

p=Path("src/server.js")

s=p.read_text()

s=s.replace(
'"SELECT * FROM evidence WHERE id=?"',
'"SELECT * FROM food_evidence WHERE id=?"'
)

s=s.replace(
'UPDATE asset_evidence',
'UPDATE food_evidence'
)

p.write_text(s)

print("food_evidence mapping fixed")

PY


echo "Checking server syntax..."

node -c src/server.js

echo "Restart asset engine:"
echo "npm start"

