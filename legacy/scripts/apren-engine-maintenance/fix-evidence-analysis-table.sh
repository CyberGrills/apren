#!/bin/bash

set -e

echo "Aligning evidence analyzer with existing evidence storage..."

python3 - <<'PY'
from pathlib import Path
import re

p=Path("src/server.js")

s=p.read_text()


# Find the evidence table used by existing routes
matches=re.findall(
r'SELECT \* FROM ([a-zA-Z_]+).*?asset_id',
s,
re.S
)

print("Detected tables:", matches)


# Replace analyzer query to use evidence table
s=s.replace(
'''const evidence =
db.prepare(
"SELECT * FROM asset_evidence WHERE id=?"
)
.get(req.params.evidenceId);''',
'''const evidence =
db.prepare(
"SELECT * FROM evidence WHERE id=?"
)
.get(req.params.evidenceId);'''
)


# If the table name differs, patch manually from route discovery
if "SELECT * FROM evidence WHERE id=?" not in s:

    print("Manual table patch required")

else:

    print("Analyzer linked to evidence table")


p.write_text(s)

PY


echo "Restart asset engine:"
echo "npm start"

