#!/bin/bash

set -e

echo "Installing āprən Freshness Decay Engine..."

mkdir -p src/intelligence


cat > src/intelligence/decay.js <<'JS'

function calculateDecay(asset){

    const now = new Date();

    const verified =
        new Date(
            asset.verifiedAt || now
        );


    let lifetimeHours = 24;


    if(asset.category === "Prepared meals"){
        lifetimeHours = 24;
    }


    if(asset.category === "Produce"){
        lifetimeHours = 72;
    }


    if(asset.category === "Grains"){
        lifetimeHours = 720;
    }


    const ageHours =
        (now - verified) /
        (1000 * 60 * 60);


    let remainingHours =
        lifetimeHours - ageHours;


    if(remainingHours < 0){
        remainingHours = 0;
    }


    const freshness =
        Math.round(
            (remainingHours / lifetimeHours) * 100
        );


    let state="FRESH";


    if(freshness <= 50){
        state="WARNING";
    }


    if(freshness <= 20){
        state="EXPIRING";
    }


    if(freshness === 0){
        state="EXPIRED";
    }


    return {

        freshness,

        remainingHours:
            Number(
              remainingHours.toFixed(2)
            ),

        lifetimeHours,

        state,

        checkedAt:
            now.toISOString()

    };

}


module.exports=calculateDecay;

JS



python3 - <<'PY'
from pathlib import Path

p=Path("src/server.js")

s=p.read_text()


if 'require("./intelligence/decay")' not in s:
    s=s.replace(
        'const analyzeFreshness = require("./intelligence/freshness");',
        'const analyzeFreshness = require("./intelligence/freshness");\nconst calculateDecay = require("./intelligence/decay");'
    )


routes=r'''

app.get("/freshness/:id",(req,res)=>{


 const asset = assets.find(
    a => a.id === Number(req.params.id)
 );


 if(!asset){

    return res.status(404).json({
       error:"Asset not found"
    });

 }


 const result =
    calculateDecay({

      ...asset,

      verifiedAt:
        asset.verifiedAt

    });


 res.json({

    system:
      "apren-freshness-engine",

    asset:
      asset.name,

    result

 });


});

'''

if 'app.get("/freshness/:id"' not in s:
    s=s.replace(
        'app.listen(4003,()=>{',
        routes+'\napp.listen(4003,()=>{'
    )


p.write_text(s)

print("Freshness decay routes added")

PY


npm install


echo ""
echo "Freshness Decay Engine installed."
echo "Restart assets service with:"
echo "npm start"

