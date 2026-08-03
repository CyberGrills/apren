#!/bin/bash

set -e

echo "Repairing āprən asset database syntax..."

python3 - <<'PY'
from pathlib import Path
import re

p=Path("src/db.js")

s=p.read_text()


# Remove broken standalone SQL block
s=re.sub(
r'\nCREATE TABLE IF NOT EXISTS asset_evidence \([\s\S]*?\);\n',
'\n',
s
)


# Insert correctly before module export
table=r'''

db.exec(`

CREATE TABLE IF NOT EXISTS asset_evidence (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    asset_id INTEGER NOT NULL,

    type TEXT,

    file TEXT,

    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,

    analysis_status TEXT DEFAULT 'PENDING',

    freshness_score REAL,

    confidence REAL

);

`);

'''


if "CREATE TABLE IF NOT EXISTS asset_evidence" not in s:

    s=s.replace(
        "module.exports = db;",
        table + "module.exports = db;"
    )


p.write_text(s)

print("db.js repaired")

PY


echo "Checking db.js..."

node -c src/db.js

echo "Syntax OK"

echo "Restart with:"
echo "npm start"

