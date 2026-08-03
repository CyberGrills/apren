#!/bin/bash
set -e

echo "=== Fix Layer 7 Governor Body Input ==="

cd ~/apren

mkdir -p backups/layer7-governor-body-fix

cp services/assets/src/server.js \
backups/layer7-governor-body-fix/server.js-$(date +%Y%m%d_%H%M%S)


python3 <<'PY'
from pathlib import Path

path = Path("services/assets/src/server.js")

text = path.read_text()

old = '''await executiveGovernorEngine.govern(
req.params.assetId
)'''

new = '''await executiveGovernorEngine.govern(
req.params.assetId,
req.body
)'''

if old not in text:
    raise SystemExit("Governor route body pattern not found")

text=text.replace(old,new)

path.write_text(text)

PY


node --check services/assets/src/server.js

echo "=== COMPLETE ==="

