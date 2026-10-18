#!/bin/bash
set -e

echo "=== Fix Layer 8 Memory Route Priority ==="

cd ~/apren


mkdir -p backups/layer8-memory-route-fix


cp services/assets/src/server.js \
backups/layer8-memory-route-fix/server.js-$(date +%Y%m%d_%H%M%S)



python3 <<'PY'
from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


# Move recall route above dynamic memory routes if duplicated

start=text.find('app.get("/brain/memory/recall/:assetId"')

if start != -1:

    block_start=start

    block_end=text.find("});", start)

    block=text[block_start:block_end+3]

    text=text.replace(block,"")

    insert=text.find('app.post("/brain/memory/build/:assetId"')

    if insert != -1:
        text=text[:insert]+block+"\n\n"+text[insert:]


path.write_text(text)

PY


node --check services/assets/src/server.js


echo "=== Verify memory routes ==="

grep -n "brain/memory" services/assets/src/server.js


echo "=== COMPLETE ==="

