#!/bin/bash

set -e

echo "āprən Evidence Table Synchronization..."

python3 - <<'PY'
from pathlib import Path

db=Path("src/db.js")

s=db.read_text()

table=r'''

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

'''

if "CREATE TABLE IF NOT EXISTS asset_evidence" not in s:

    s=s.replace(
        "module.exports = db;",
        table + "\nmodule.exports = db;"
    )

    db.write_text(s)

    print("asset_evidence table added")

else:

    print("asset_evidence already exists")


server=Path("src/server.js")

s=server.read_text()


# Ensure table initializes when server starts
if 'asset_evidence' not in s.split("app.get")[0]:

    s=s.replace(
        'const app = express();',
        '''const app = express();


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
    )


server.write_text(s)

print("server evidence initialization fixed")

PY


echo "Restarting āprən Asset Engine..."

pkill -f "node src/server.js" || true

sleep 2

echo "Start engine again:"
echo "npm start"
