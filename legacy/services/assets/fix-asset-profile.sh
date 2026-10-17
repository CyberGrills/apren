#!/bin/bash

set -e

echo "Fixing āprən Asset Profile Engine..."

python3 - <<'PY'
from pathlib import Path

p=Path("src/server.js")

s=p.read_text()

start=s.find('app.get("/asset-profile/:id"')

if start == -1:
    raise SystemExit("asset-profile route not found")

end=s.find('\n});', start)

if end == -1:
    raise SystemExit("route ending not found")

end=end+4

new_route=r'''
app.get("/asset-profile/:id",(req,res)=>{

 const id=req.params.id;

 try {

   const asset = db.prepare(
     "SELECT * FROM assets WHERE id=?"
   ).get(id);


   if(!asset){
      return res.status(404).json({
        error:"Asset not found",
        assetId:id
      });
   }


   const freshness = freshnessEngine.calculate(asset);


   const passport = passportDB.getPassport(id)
      || {
          assetId:id,
          status:"CREATED"
        };


   const ownership = ownershipDB.getOwnership(id)
      || {
          assetId:id,
          owner:null
        };


   const lifecycleEvents =
      lifecycle.getEvents(id);


   const verification =
      verificationEngine.verify(id);


   res.json({

      system:"apren-food-asset-profile",

      asset,

      intelligence:{
        freshness
      },

      passport,

      ownership,

      lifecycle:lifecycleEvents,

      verification

   });


 } catch(error){

    res.status(500).json({
      error:error.message
    });

 }

});
'''

s=s[:start]+new_route+s[end:]

p.write_text(s)

print("Asset profile route replaced")

PY


echo "Checking syntax..."

node --check src/server.js

echo "Restarting Asset Engine..."

pkill -f "node src/server.js" || true

sleep 2

npm start

