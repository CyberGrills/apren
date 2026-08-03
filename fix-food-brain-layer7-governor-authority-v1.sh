#!/bin/bash
set -e

echo "=== Fix Food Brain Layer 7 Governor Authority ==="

cd ~/apren

mkdir -p backups/layer7-governor-authority-fix

cp services/assets/src/server.js \
backups/layer7-governor-authority-fix/server.js-$(date +%Y%m%d_%H%M%S)


python3 <<'PY'
from pathlib import Path

path = Path("services/assets/src/server.js")

text = path.read_text()


# Replace old route variable usage
text = text.replace(
'await executiveGovernor.govern(',
'await executiveGovernorEngine.govern('
)


# Remove old conflicting import
old = 'const executiveGovernor = require("./governor/executiveGovernor");'

text = text.replace(
old,
''
)


path.write_text(text)

PY


echo "=== Verify governor imports ==="

grep -n "executiveGovernor" services/assets/src/server.js


node --check services/assets/src/server.js


echo "=== COMPLETE ==="

