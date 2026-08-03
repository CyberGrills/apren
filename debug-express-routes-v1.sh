#!/bin/bash
set -e

cd ~/apren

cp services/assets/src/server.js \
services/assets/src/server.js.debug-backup

python3 <<'PY'
from pathlib import Path

p=Path("services/assets/src/server.js")
text=p.read_text()

old='''app.listen(4003,()=>{

console.log(
"āprən Food Asset Engine running on 4003"
);

});'''

new='''

console.log("=== REGISTERED ROUTES ===");

if(app._router){

app._router.stack
.filter(r=>r.route)
.forEach(r=>{
console.log(
Object.keys(r.route.methods).join(",").toUpperCase(),
r.route.path
);
});

}

app.listen(4003,()=>{

console.log(
"āprən Food Asset Engine running on 4003"
);

});'''

if old not in text:
    raise SystemExit("listen block not found")

text=text.replace(old,new)

p.write_text(text)

PY

node --check services/assets/src/server.js

echo "DEBUG PATCH COMPLETE"

