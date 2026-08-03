#!/bin/bash
set -e

echo "=== āprən Food Brain Predictive Intelligence Layer 32 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer32-predictive-intelligence

cp -r services/assets/src \
backups/layer32-predictive-intelligence/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating prediction database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_predictions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

prediction_type TEXT,

prediction TEXT,

recommended_action TEXT,

reasoning JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_predictions_asset
ON food_brain_predictions(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_prediction_history
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

prediction_id INTEGER,

actual_result JSONB,

accuracy_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_prediction_history_asset
ON food_brain_prediction_history(asset_id);



SQL



echo "=== Creating prediction engines ==="


mkdir -p services/assets/src/prediction



cat > services/assets/src/prediction/freshnessPredictionEngine.js <<'JS'


function predict(data){

let prediction="FRESHNESS_STABLE";

let confidence=50;

let action="MONITOR";


if(data.freshness < 30){

prediction="FRESHNESS_COLLAPSE_EXPECTED";

confidence+=35;

action="DISTRIBUTE_FAST";

}


if(data.freshness < 15){

prediction="CRITICAL_FRESHNESS_RISK";

confidence+=15;

action="IMMEDIATE_MOVEMENT";

}


if(confidence>100)
confidence=100;


return {

prediction,

confidence,

action

};

}


module.exports={
predict
};

JS



cat > services/assets/src/prediction/demandForecastEngine.js <<'JS'


function forecast(data){

let prediction="DEMAND_NORMAL";

let confidence=50;

let action="MONITOR";


if(data.demand==="HIGH"){

prediction="DEMAND_SURGE_EXPECTED";

confidence+=35;

action="INCREASE_VISIBILITY";

}


if(data.supply==="LOW"){

confidence+=15;

}


if(confidence>100)
confidence=100;


return {

prediction,

confidence,

action

};

}


module.exports={
forecast
};

JS



cat > services/assets/src/prediction/valueForecastEngine.js <<'JS'


function forecast(data){

let value=data.value || 50;

let prediction="VALUE_STABLE";

let confidence=50;

let action="HOLD";


if(data.demand==="HIGH"){

value+=10;

prediction="VALUE_INCREASE_EXPECTED";

confidence+=25;

action="PROMOTE";

}


if(data.freshness < 30){

value-=15;

prediction="VALUE_DROP_RISK";

confidence+=25;

action="ADJUST_PRICE";

}


return {

future_value:value,

prediction,

confidence,

action

};

}



module.exports={
forecast
};

JS



cat > services/assets/src/prediction/wasteRiskPredictionEngine.js <<'JS'


function predict(data){

let risk="LOW";

let confidence=40;

let action="NORMAL_FLOW";


if(data.freshness < 30){

risk="HIGH";

confidence+=40;

action="REDUCE_WASTE";

}


if(data.demand==="LOW"){

risk="CRITICAL";

confidence+=20;

action="REDIRECT_ASSET";

}


if(confidence>100)
confidence=100;


return {

risk,

confidence,

action

};

}


module.exports={
predict
};

JS



cat > services/assets/src/prediction/predictiveFoodBrain.js <<'JS'


const freshness =
require("./freshnessPredictionEngine");

const demand =
require("./demandForecastEngine");

const value =
require("./valueForecastEngine");

const waste =
require("./wasteRiskPredictionEngine");

const {pool}=require("../postgres");



async function predict(assetId,data){


const results={

freshness:freshness.predict(data),

demand:demand.forecast(data),

value:value.forecast(data),

waste:waste.predict(data)

};



let strongest =
results.freshness;


if(results.waste.confidence > strongest.confidence)
strongest=results.waste;


if(results.demand.confidence > strongest.confidence)
strongest=results.demand;



await pool.query(
`
INSERT INTO food_brain_predictions
(
asset_id,
prediction_type,
prediction,
recommended_action,
reasoning,
confidence
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
assetId,
"FOOD_FORECAST",
strongest.prediction,
strongest.action,
JSON.stringify(results),
strongest.confidence
]
);



return {

asset_id:assetId,

predictions:results,

primary_prediction:strongest

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
require("../prediction/predictiveFoodBrain");


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
 'const brainMemoryRoutes = require("./routes/brainMemoryRoutes");',
 '''const brainMemoryRoutes = require("./routes/brainMemoryRoutes");

const brainPredictionRoutes = require("./routes/brainPredictionRoutes");'''
 )


if 'app.use("/brain", brainPredictionRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainMemoryRoutes);',
 '''app.use("/brain", brainMemoryRoutes);

app.use("/brain", brainPredictionRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 32 modules ==="


node - <<'NODE'

require("./services/assets/src/prediction/freshnessPredictionEngine");

require("./services/assets/src/prediction/demandForecastEngine");

require("./services/assets/src/prediction/valueForecastEngine");

require("./services/assets/src/prediction/wasteRiskPredictionEngine");

require("./services/assets/src/prediction/predictiveFoodBrain");


console.log(
"Layer 32 predictive food intelligence loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 32 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test prediction engine"
echo "3. commit + tag"


