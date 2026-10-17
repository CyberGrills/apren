#!/bin/bash

set -e

echo "Upgrading āprən Food Asset Identity Layer v2..."

mkdir -p src/intelligence
mkdir -p src/identity


cat > src/identity/profile.js <<'JS'
function createAssetProfile(asset, passport, ownership, verification, freshness, lifecycle){

    return {

        assetIdentity:{
            id:asset.id,
            name:asset.name,
            category:asset.category,
            origin:asset.kitchen
        },

        value:{
            amount:asset.base_value,
            currency:asset.currency
        },

        ownership:{
            owner:ownership.owner,
            quantity:ownership.quantity,
            status:ownership.status
        },

        trust:{
            verified:
                verification.records.length > 0,

            evidence:
                verification.records
        },


        freshness:{
            score:freshness.result.freshness,
            state:freshness.result.state,
            remainingHours:freshness.result.remainingHours
        },


        lifecycle:{
            events:lifecycle.events
        },


        tradingReady:
            freshness.result.freshness > 50 &&
            verification.records.length > 0

    };

}


module.exports=createAssetProfile;
JS



python3 - <<'PY'
from pathlib import Path

p=Path("src/server.js")

s=p.read_text()

if 'createAssetProfile' not in s:
    s=s.replace(
        'const cors = require("cors");',
        'const cors = require("cors");\nconst createAssetProfile = require("./identity/profile");'
    )


route=r'''

app.get("/asset-profile/:id",(req,res)=>{

 const asset = assets.find(
    a => a.id === Number(req.params.id)
 );


 if(!asset){
    return res.status(404).json({
      error:"Asset not found"
    });
 }


 const passport={
    assetId:asset.id,
    origin:asset.kitchen
 };


 const ownership={
    owner:asset.owner_id,
    quantity:1,
    status:"owned"
 };


 const verification={
    records:[
      {
        type:"image",
        status:"VERIFIED"
      }
    ]
 };


 const freshness={
    result:{
      freshness:asset.freshness,
      state:"FRESH",
      remainingHours:24
    }
 };


 const lifecycle={
    events:[
      {
        type:"CREATED",
        description:"Food asset registered"
      }
    ]
 };


 res.json({
    system:"apren-food-asset-profile",
    profile:createAssetProfile(
      asset,
      passport,
      ownership,
      verification,
      freshness,
      lifecycle
    )
 });

});

'''


if 'app.get("/asset-profile/:id"' not in s:
    s=s.replace(
        'app.listen(4003,()=>{',
        route+'\napp.listen(4003,()=>{'
    )


p.write_text(s)

print("Asset Identity Layer v2 installed")

PY


node --check src/server.js

echo ""
echo "Restarting āprən Asset Engine..."

pkill -f "node src/server.js" || true

sleep 2

echo "Start with:"
echo "npm start"

echo ""
echo "Upgrade complete."
