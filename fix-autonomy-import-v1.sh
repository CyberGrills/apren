#!/bin/bash
set -e

echo "=== Fix āprən autonomy imports ==="

cd ~/apren

python3 <<'PY'
from pathlib import Path

path = Path("services/assets/src/server.js")

text = path.read_text()

if 'require("./autonomy/actionEngine")' not in text:

    anchor='const feedbackEngine'

    if anchor in text:
        text=text.replace(
            anchor,
            '''const actionEngine = require("./autonomy/actionEngine");
const automationEngine = require("./autonomy/automationEngine");

const feedbackEngine'''
        )

    else:
        insert=text.find("app.listen")
        text=text[:insert]+'''
const actionEngine = require("./autonomy/actionEngine");
const automationEngine = require("./autonomy/automationEngine");

'''+text[insert:]

    path.write_text(text)

print("imports fixed")
PY


node --check services/assets/src/server.js

echo "=== COMPLETE ==="

