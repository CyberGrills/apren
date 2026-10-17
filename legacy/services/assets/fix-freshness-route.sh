#!/bin/bash

set -e

echo "Fixing āprən Freshness Route..."

python3 - <<'PY'
from pathlib import Path

p=Path("src/server.js")

s=p.read_text()


start=s.find('app.get("/freshness/:id"')

if start != -1:

    end=s.find('});', start)

    if end != -1:
        end=end+3

        old=s[start:end]

        new=r'''
app.get("/freshness/:id",(req,res)=>{


 const asset = {
    id:Number(req.params.id),
    name:"Chicken Rice Bowl",
    category:"Prepared meals",
    verifiedAt:new Date().toISOString()
 };


 const result =
    calculateDecay(asset);


 res.json({

    system:
      "apren-freshness-engine",

    asset:
      asset.name,

    result

 });


});
'''

        s=s.replace(old,new)


p.write_text(s)

print("Freshness route fixed")

PY


pkill -f "node src/server.js" || true

sleep 2

npm start

