#!/bin/bash
set -e

echo "=== āprən Food Brain Predictive Intelligence Layer 39 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer39-predictive-intelligence

cp -r services/assets/src \
backups/layer39-predictive-intelligence/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating predictive database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_predictions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER,

prediction_type TEXT,

input_state JSONB,

prediction JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_predictions_asset
ON food_brain_predictions(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_prediction_accuracy
(
id SERIAL PRIMARY KEY,

asset_id INTEGER,

prediction_id INTEGER,

expected JSONB,

actual JSONB,

accuracy_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_asset
ON food_brain_prediction_accuracy(asset_id);


SQL



echo "=== Creating prediction engines ==="


mkdir -p services/assets/src/prediction



cat > services/assets/src/prediction/demandPredictionEngine.js <<'JS'


function predict(data){

let demand="STABLE";
let confidence=60;


if(data.demand==="HIGH"){

demand="INCREASING";
confidence=90;

}


if(data.supply==="LOW" && data.demand==="HIGH"){

demand="SURGING";
confidence=95;

}


return {

prediction:"DEMAND_"+demand,

confidence

};

}


module.exports={
predict
};

JS



cat > services/assets/src/prediction/freshnessPredictionEngine.js <<'JS'


function predict(data){


let status="SAFE";

let confidence=70;



if(data.freshness < 15){

status="CRITICAL";

confidence=95;

}
else if(data.freshness < 30){

status="DECLINING";

confidence=85;

}


return {

prediction:"FRESHNESS_"+status,

confidence

};


}


module.exports={
predict
};

JS




cat > services/assets/src/prediction/valuePredictionEngine.js <<'JS'


function predict(data){


let value=data.value || 50;

let direction="STABLE";

let confidence=60;



if(data.demand==="HIGH"){

value +=20;

direction="UP";

confidence=90;

}



if(data.supply==="LOW"){

value +=15;

confidence=95;

}



return {

prediction:"VALUE_"+direction,

estimated_value:value,

confidence

};


}


module.exports={
predict
};

JS




cat > services/assets/src/prediction/predictiveBrain.js <<'JS'


const demand =
require("./demandPredictionEngine");

const freshness =
require("./freshnessPredictionEngine");

const value =
require("./valuePredictionEngine");


const {pool}=require("../postgres");



async function predict(assetId,data){


const predictions=[

demand.predict(data),

freshness.predict(data),

value.predict(data)

];



let confidence = Math.round(

predictions.reduce(
(a,b)=>a+b.confidence,0
)
/ predictions.length

);



const result={

future_state:predictions,

overall_confidence:confidence

};



await pool.query(
`
INSERT INTO food_brain_predictions
(
asset_id,
prediction_type,
input_state,
prediction,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
"AUTONOMOUS_FORECAST",
JSON.stringify(data),
JSON.stringify(result),
confidence
]
);



return {

asset_id:assetId,

prediction:result

};


}


module.exports={
predict
};


JS




echo "=== Creating prediction route ==="



cat > services/assets/src/routes/brainPredictionRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const brain =
require("../prediction/predictiveBrain");



router.post(
"/predict/:assetId",
async(req,res)=>{

try{

res.json(
await brain.predict(
req.params.assetId,
req.body
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


module.exports=router;


JS




echo "=== Register prediction route ==="



python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainPredictionRoutes" not in text:

 text=text.replace(
 'const brainSimulationRoutes = require("./routes/brainSimulationRoutes");',
 '''const brainSimulationRoutes = require("./routes/brainSimulationRoutes");

const brainPredictionRoutes = require("./routes/brainPredictionRoutes");'''
 )


if 'app.use("/brain", brainPredictionRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainSimulationRoutes);',
 '''app.use("/brain", brainSimulationRoutes);

app.use("/brain", brainPredictionRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 39 modules ==="



node - <<'NODE'

require("./services/assets/src/prediction/demandPredictionEngine");

require("./services/assets/src/prediction/freshnessPredictionEngine");

require("./services/assets/src/prediction/valuePredictionEngine");

require("./services/assets/src/prediction/predictiveBrain");


console.log(
"Layer 39 predictive intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 39 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test prediction brain"
echo "3. commit + tag"

