#!/bin/bash
set -e

echo "=== Fix Food Brain Layer 5 Decision Import ==="

cd ~/apren

mkdir -p backups/layer5-decision-import-fix

cp services/assets/src/server.js \
backups/layer5-decision-import-fix/server.js-$(date +%Y%m%d_%H%M%S)


python3 <<'PY'

from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


import_line=None

for line in text.splitlines():

    if "const decisionEngine" in line:
        import_line=line


if not import_line:
    raise SystemExit("decisionEngine import not found")


old=import_line

new='const decisionEngine = require("./decision/decisionEngine");'


text=text.replace(old,new)


path.write_text(text)

PY


echo "=== Verify ==="

grep -n "decisionEngine" services/assets/src/server.js


node --check services/assets/src/server.js


echo "=== COMPLETE ==="

