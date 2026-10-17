#!/bin/bash
set -e

echo "=== Fix Food Brain Layer 3 Prediction Import ==="

cd ~/apren

mkdir -p backups/layer3-prediction-import-fix

cp services/assets/src/server.js \
backups/layer3-prediction-import-fix/server.js-$(date +%Y%m%d_%H%M%S)


python3 <<'PY'
from pathlib import Path

path = Path("services/assets/src/server.js")

text = path.read_text()

old = 'const predictionEngine = require("./memory/predictionEngine");'

new = 'const predictionEngine = require("./prediction/predictionEngine");'

if old in text:
    text = text.replace(old, new)
else:
    raise SystemExit("Old prediction import not found")

path.write_text(text)

PY


echo "=== Verify import ==="

grep -n "predictionEngine" services/assets/src/server.js


node --check services/assets/src/server.js


echo "=== COMPLETE ==="

