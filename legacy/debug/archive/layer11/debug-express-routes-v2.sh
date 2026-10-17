#!/bin/bash
set -e

cd ~/apren

cp services/assets/src/server.js \
services/assets/src/server.js.debug-v2-backup

python3 <<'PY'
from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


old='''console.log("=== REGISTERED ROUTES ===");

if(app._router){

app._router.stack
.filter(r=>r.route)
.forEach(r=>{
console.log(
Object.keys(r.route.methods).join(",").toUpperCase(),
r.route.path
);
});

}'''


new='''console.log("=== REGISTERED ROUTES ===");

const router = app._router || app.router;

if(router && router.stack){

router.stack
.filter(r=>r.route)
.forEach(r=>{
console.log(
Object.keys(r.route.methods)
.join(",")
.toUpperCase(),
r.route.path
);
});

}
else{

console.log("NO ROUTER STACK FOUND");

}'''


if old not in text:
    raise SystemExit("debug block not found")


text=text.replace(old,new)

p.write_text(text)

PY


node --check services/assets/src/server.js

echo "DEBUG V2 READY"

