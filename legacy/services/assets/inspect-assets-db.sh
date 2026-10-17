#!/bin/bash

echo "Inspecting āprən Asset Database..."

python3 - <<'PY'
from pathlib import Path
import re

for f in Path(".").rglob("*"):
    if f.suffix in [".db",".sqlite",".sqlite3"]:
        print("DATABASE:",f)

print("\nChecking db.js:")
print("--------------------------------")

print(Path("src/db.js").read_text())

PY

