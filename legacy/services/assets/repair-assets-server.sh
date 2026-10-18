#!/bin/bash

set -e

echo "Repairing āprən Asset Engine server..."

python3 - <<'PY'
from pathlib import Path

p = Path("src/server.js")

s = p.read_text()


# Remove broken freshness route block
start = s.find('app.get("/freshness/:id"')

if start != -1:

    end = s.find('app.listen(4003', start)

    if end != -1:

        s = s[:start] + s[end:]


# Add correct freshness route before listen
route = r'''

app.get("/freshness/:id",(req,res)=>{


 const result = calculateDecay({

    id:Number(req.params.id),

    name:"Chicken Rice Bowl",

    category:"Prepared meals",

    verifiedAt:new Date()

 });


 res.json({

    system:"apren-freshness-engine",

    assetId:req.params.id,

    result

 });


});


'''


if 'app.get("/freshness/:id"' not in s:

    s=s.replace(
        'app.listen(4003,()=>{',
        route+'app.listen(4003,()=>{'
    )


p.write_text(s)

print("Server repaired")

PY


echo "Checking syntax..."

node --check src/server.js


echo "Starting āprən Asset Engine..."

npm start

