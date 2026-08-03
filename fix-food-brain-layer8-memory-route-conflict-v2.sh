#!/bin/bash
set -e

echo "=== Fix Layer 8 Memory Dynamic Route Conflict ==="

cd ~/apren


mkdir -p backups/layer8-memory-route-conflict-v2

cp services/assets/src/server.js \
backups/layer8-memory-route-conflict-v2/server.js-$(date +%Y%m%d_%H%M%S)



python3 <<'PY'
from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


# Locate generic conflicting route
generic='app.get("/brain/memory/:assetId"'


generic_pos=text.find(generic)


if generic_pos == -1:
    raise SystemExit("Generic memory route not found")


# Extract recall route
recall_start=text.find(
'app.get("/brain/memory/recall/:assetId"'
)


if recall_start == -1:
    raise SystemExit("Recall route not found")


recall_end=text.find(
"});",
recall_start
)


recall_block=text[recall_start:recall_end+3]


text=text.replace(
recall_block,
""
)


generic_pos=text.find(generic)


text=text[:generic_pos]+recall_block+"\n\n"+text[generic_pos:]


path.write_text(text)

PY



node --check services/assets/src/server.js


echo "=== Route order check ==="

grep -n "brain/memory" services/assets/src/server.js | head -15


echo "=== COMPLETE ==="

