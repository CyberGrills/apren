#!/bin/bash
set -e

echo "=== Fix Layer 3 Prediction Body Input ==="

cd ~/apren

mkdir -p backups/layer3-prediction-body-fix

cp services/assets/src/server.js \
backups/layer3-prediction-body-fix/server.js-$(date +%Y%m%d_%H%M%S)


python3 <<'PY'
from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()

old='''await predictionEngine.predict(
req.params.assetId
)'''

new='''await predictionEngine.predict(
req.params.assetId,
req.body
)'''

if old not in text:
    raise SystemExit("Prediction route pattern not found")

text=text.replace(old,new)

path.write_text(text)

PY


node --check services/assets/src/server.js

echo "=== COMPLETE ==="

