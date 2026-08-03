#!/bin/bash
set -e

echo "=== Fixing Layer 32 Predictive Engine JSONB Compatibility ==="

python3 <<'PY'
from pathlib import Path

p = Path("services/assets/src/prediction/predictiveFoodBrain.js")

text = p.read_text()

old = """strongest.prediction,
strongest.action,
JSON.stringify(results),
strongest.confidence"""

new = """JSON.stringify({
prediction: strongest.prediction
}),
strongest.action,
JSON.stringify(results),
strongest.confidence"""

if old in text:
    text = text.replace(old,new)

p.write_text(text)

PY


node --check services/assets/src/prediction/predictiveFoodBrain.js

echo "=== Layer 32 engine fixed ==="

