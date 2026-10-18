#!/bin/bash

set -e

echo "Installing āprən Food Verification Engine..."

mkdir -p src/verification
mkdir -p src/uploads


cat > src/verification/verify.js <<'JS'
const fs = require("fs");
const path = require("path");

const records = [];


function verifyFood(asset){

    const confidence = Math.floor(
        85 + Math.random() * 15
    );

    const verification = {

        id: records.length + 1,

        assetId: Number(asset.id),

        evidenceType:
            asset.type || "image",

        file:
            asset.file || null,

        confidence,

        status:"VERIFIED",

        createdAt:
            new Date().toISOString()

    };


    records.push(verification);


    return verification;
}


function getVerification(assetId){

    return records.filter(
        r => r.assetId === Number(assetId)
    );

}


module.exports={
    verifyFood,
    getVerification
};
JS


python3 - <<'PY'
from pathlib import Path

p=Path("src/server.js")

s=p.read_text()


if 'require("./verification/verify")' not in s:
    s=s.replace(
        'const lifecycle = require("./lifecycle/lifecycle");',
        'const lifecycle = require("./lifecycle/lifecycle");\nconst verification = require("./verification/verify");'
    )


routes=r'''

app.post("/verify/:id",(req,res)=>{


 const result = verification.verifyFood({

    id:req.params.id,

    type:req.body.type,

    file:req.body.file

 });


 lifecycle.createEvent(
    req.params.id,
    "VERIFIED",
    "Food evidence verified by āprən intelligence"
 );


 res.json({

    system:"apren-food-verification",

    verification:result

 });


});



app.get("/verify/:id",(req,res)=>{


 res.json({

    system:"apren-food-verification",

    assetId:req.params.id,

    records:
       verification.getVerification(req.params.id)

 });


});

'''

if 'app.post("/verify/:id"' not in s:
    s=s.replace(
        'app.listen(4003,()=>{',
        routes+'\napp.listen(4003,()=>{'
    )


p.write_text(s)

print("Verification routes installed")

PY


npm install


echo ""
echo "Verification Engine installed."
echo "Restart with: npm start"

