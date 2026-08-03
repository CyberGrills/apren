#!/bin/bash
set -e

echo "=== Promote Layer 11 Autonomous Decision Authority ==="

cd ~/apren

mkdir -p backups/layer11-authority-route-v2

cp services/assets/src/server.js \
backups/layer11-authority-route-v2/server.js-$(date +%Y%m%d_%H%M%S)


python3 <<'PY'
from pathlib import Path

path = Path("services/assets/src/server.js")

text = path.read_text()


old = '''await decisionEngine.decide(
req.params.assetId,
req.body
)'''


new = '''await autonomousDecisionEngine.decide(
req.params.assetId,
req.body.simulations
)'''


if old not in text:
    raise SystemExit("Layer 11 decision route pattern not found")


text = text.replace(old,new,1)


path.write_text(text)

PY


node --check services/assets/src/server.js


echo "=== Verify route ==="

sed -n '3835,3855p' services/assets/src/server.js

echo "=== COMPLETE ==="

