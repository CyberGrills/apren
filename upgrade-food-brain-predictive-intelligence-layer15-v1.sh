#!/bin/bash
set -e

echo "=== āprən Food Brain Predictive Intelligence Layer 15 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer15-predictive-intelligence

cp -r services/assets/src \
backups/layer15-predictive-intelligence/src-$(date +%Y%m%d_%H%M%S)



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

current_value NUMERIC,

predicted_value NUMERIC,

freshness_prediction NUMERIC,

confidence NUMERIC,

recommended_action TEXT,

reason TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_prediction_asset
ON food_brain_predictions(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_prediction_history
(
id SERIAL PRIMARY KEY,

prediction_id INTEGER REFERENCES food_brain_predictions(id)
ON DELETE CASCADE,

actual_value NUMERIC,

accuracy_score NUMERIC,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_prediction_history
ON food_brain_prediction_history(prediction_id);


SQL



echo "=== Creating prediction modules ==="


mkdir -p services/assets/src/prediction



cat > services/assets/src/prediction/freshnessPredictionEngine.js <<'JS'

function predict(hoursRemaining){

let freshness =
Math.max(
0,
Math.min(
100,
(hoursRemaining / 24) * 100
)
);


return Number(
freshness.toFixed(2)
);

}


module.exports={
predict
};

JS





cat > services/assets/src/prediction/marketPredictionEngine.js <<'JS'

function predict(value,freshness){


let predicted=value;


if(freshness < 50){

predicted=value*0.7;

}


else if(freshness < 75){

predicted=value*0.85;

}



return Number(
predicted.toFixed(2)
);

}



module.exports={
predict
};

JS





cat > services/assets/src/prediction/riskForecastEngine.js <<'JS'

function evaluate(freshness){


if(freshness < 40){

return "HIGH";

}


if(freshness < 70){

return "MEDIUM";

}


return "LOW";

}


module.exports={
evaluate
};

JS





cat > services/assets/src/prediction/valueForecastEngine.js <<'JS'

const market =
require("./marketPredictionEngine");


function forecast(value,freshness){


return market.predict(
value,
freshness
);


}


module.exports={
forecast
};

JS





cat > services/assets/src/prediction/predictiveIntelligenceEngine.js <<'JS'

const freshness =
require("./freshnessPredictionEngine");

const value =
require("./valueForecastEngine");

const risk =
require("./riskForecastEngine");

const {pool}=require("../postgres");



async function predict(assetId,data){


const freshnessScore =
freshness.predict(
data.hoursRemaining || 24
);



const predictedValue =
value.forecast(
data.currentValue || 0,
freshnessScore
);



const riskLevel =
risk.evaluate(
freshnessScore
);



let action="HOLD";


if(riskLevel==="HIGH"){

action="SELL_NOW";

}

else if(riskLevel==="MEDIUM"){

action="PROMOTE";

}



const result =
await pool.query(
`
INSERT INTO food_brain_predictions
(
asset_id,
prediction_type,
current_value,
predicted_value,
freshness_prediction,
confidence,
recommended_action,
reason
)

VALUES
($1,$2,$3,$4,$5,$6,$7,$8)

RETURNING *
`,
[
assetId,
"FOOD_VALUE_FORECAST",
data.currentValue || 0,
predictedValue,
freshnessScore,
85,
action,
"Prediction generated from freshness and value signals"
]
);



return {

asset_id:assetId,

prediction:{
freshness:freshnessScore,
risk:riskLevel
},

forecast:{
current_value:data.currentValue || 0,
predicted_value:predictedValue
},

recommendation:{
action,
reason:"Value preservation based on forecast"
},

confidence:85,

record:result.rows[0]

};

}



module.exports={
predict
};

JS




echo "=== Creating prediction routes ==="


cat > services/assets/src/routes/brainPredictionRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const prediction =
require("../prediction/predictiveIntelligenceEngine");



const {pool}=require("../postgres");



router.post("/predict/:assetId",async(req,res)=>{

try{

res.json(
await prediction.predict(
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





router.get("/prediction/history/:assetId",async(req,res)=>{

try{

const result =
await pool.query(
`
SELECT *

FROM food_brain_predictions

WHERE asset_id=$1

ORDER BY created_at DESC
`,
[
req.params.assetId
]
);


res.json(result.rows);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


module.exports=router;

JS




echo "=== Register routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainPredictionRoutes" not in text:

    text=text.replace(
    'const brainLearningRoutes = require("./routes/brainLearningRoutes");',
    '''const brainLearningRoutes = require("./routes/brainLearningRoutes");

const brainPredictionRoutes = require("./routes/brainPredictionRoutes");'''
    )


if 'app.use("/brain", brainPredictionRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainLearningRoutes);',
    '''app.use("/brain", brainLearningRoutes);

app.use("/brain", brainPredictionRoutes);'''
    )


p.write_text(text)

PY




echo "=== Testing Layer 15 modules ==="


node - <<'NODE'

require("./services/assets/src/prediction/freshnessPredictionEngine");

require("./services/assets/src/prediction/marketPredictionEngine");

require("./services/assets/src/prediction/predictiveIntelligenceEngine");


console.log(
"Layer 15 predictive intelligence loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 15 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test prediction"
echo "3. commit + tag"

