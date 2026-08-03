#!/bin/bash
set -e

echo "=== Fix Layer 11 Route Placement ==="

cd ~/apren

mkdir -p backups/layer11-route-placement-v3

cp services/assets/src/server.js \
backups/layer11-route-placement-v3/server.js-$(date +%Y%m%d_%H%M%S)


python3 <<'PY'
from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


start=text.find('app.post("/brain/decision/:assetId"')


if start == -1:
    raise SystemExit("Layer 11 route not found")


end=text.find('app.get("/brain/decision/history/:assetId"', start)


if end == -1:
    raise SystemExit("Layer 11 history route not found")


end=text.find('});', end)


block=text[start:end+3]


# remove old block
text=text[:start]+text[end+3:]


# insert before simulation routes
insert=text.find('app.post("/brain/simulation/run/:assetId"')


if insert == -1:
    raise SystemExit("simulation route not found")


text=text[:insert]+block+"\n\n"+text[insert:]


p.write_text(text)

PY


node --check services/assets/src/server.js


echo "=== Verify ==="

grep -n "brain/decision" services/assets/src/server.js


echo "=== COMPLETE ==="

