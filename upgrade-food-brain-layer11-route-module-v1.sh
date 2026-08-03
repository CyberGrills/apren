#!/bin/bash
set -e

echo "=== Layer 11 Route Module Isolation ==="

cd ~/apren

mkdir -p services/assets/src/routes

mkdir -p backups/layer11-route-module

cp services/assets/src/server.js \
backups/layer11-route-module/server.js-$(date +%Y%m%d_%H%M%S)


cat > services/assets/src/routes/brainDecisionRoutes.js <<'JS'
const express = require("express");

const router = express.Router();

const autonomousDecisionEngine =
require("../decision/autonomousDecisionEngine");


router.post("/decision/:assetId", async(req,res)=>{

try{

const result =
await autonomousDecisionEngine.decide(
req.params.assetId,
req.body.simulations || []
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


router.get("/decision/history/:assetId", async(req,res)=>{

try{

res.json({
asset_id:req.params.assetId,
message:"Decision history ready"
});

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


module.exports = router;
JS


python3 <<'PY'
from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if 'brainDecisionRoutes' not in text:

    text=text.replace(
    'const express = require("express");',
    '''const brainDecisionRoutes = require("./routes/brainDecisionRoutes");

const express = require("express");'''
    )


if 'app.use("/brain", brainDecisionRoutes);' not in text:

    text=text.replace(
    'app.use(express.json());',
    '''app.use(express.json());

app.use("/brain", brainDecisionRoutes);'''
    )


p.write_text(text)

PY


node --check services/assets/src/server.js


node --check services/assets/src/routes/brainDecisionRoutes.js


echo "=== Layer 11 route module ready ==="

