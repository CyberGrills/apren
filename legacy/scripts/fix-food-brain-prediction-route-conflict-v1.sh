#!/bin/bash
set -e

echo "=== Fix Food Brain Prediction Route Conflict v1 ==="

cd ~/apren

mkdir -p backups/prediction-route-fix-v1

cp services/assets/src/server.js \
backups/prediction-route-fix-v1/server.js-$(date +%Y%m%d_%H%M%S)


echo "=== Searching duplicate routes ==="

grep -n "brain/predict" services/assets/src/server.js


echo "=== Removing old prediction handler ==="

python3 <<'PY'

from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


old_route_start=text.find(
'app.post("/brain/predict/:assetId"'
)


if old_route_start != -1:

    next_app=text.find(
    'app.',
    old_route_start+10
    )

    if next_app != -1:

        block=text[old_route_start:next_app]

        if "predictionEngine.predict" not in block:

            text=text.replace(
            block,
            ""
            )


path.write_text(text)

PY


echo "=== Checking prediction route ==="

grep -n "brain/predict" services/assets/src/server.js


node --check services/assets/src/server.js


echo "=== COMPLETE ==="

