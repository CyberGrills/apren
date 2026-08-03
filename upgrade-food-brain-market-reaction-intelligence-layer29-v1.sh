#!/bin/bash
set -e

echo "=== āprən Food Brain Market Reaction Intelligence Layer 29 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer29-market-reaction

cp -r services/assets/src \
backups/layer29-market-reaction/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating market reaction database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_market_signals
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

signal_type TEXT,

signal_data JSONB,

impact NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_market_signal_asset
ON food_brain_market_signals(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_market_predictions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

prediction TEXT,

reasoning JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_market_prediction_asset
ON food_brain_market_predictions(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_value_reactions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

previous_value NUMERIC,

new_value NUMERIC,

reaction TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_value_reaction_asset
ON food_brain_value_reactions(asset_id);



SQL



echo "=== Creating market intelligence engines ==="


mkdir -p services/assets/src/marketbrain



cat > services/assets/src/marketbrain/marketSignalEngine.js <<'JS'

const {pool}=require("../postgres");


async function record(data){

const result =
await pool.query(
`
INSERT INTO food_brain_market_signals
(
asset_id,
signal_type,
signal_data,
impact
)

VALUES($1,$2,$3,$4)

RETURNING *
`,
[
data.assetId,
data.signal,
JSON.stringify(data.context),
data.impact
]
);


return result.rows[0];

}


module.exports={
record
};

JS



cat > services/assets/src/marketbrain/demandPredictionEngine.js <<'JS'


function predict(data){


let confidence=50;

let prediction="STABLE";


if(data.demand==="HIGH"){

confidence+=25;
prediction="DEMAND_INCREASE";

}


if(data.supply==="LOW"){

confidence+=15;

}


if(data.freshness < 30){

prediction="VALUE_RISK";

confidence+=10;

}


if(confidence>100)
confidence=100;


return {

prediction,

confidence

};

}



module.exports={
predict
};

JS




cat > services/assets/src/marketbrain/valueReactionEngine.js <<'JS'


function react(data){


let reaction="HOLD";

let value=data.value || 50;


if(data.demand==="HIGH")
{

value += 10;
reaction="VALUE_INCREASE";

}


if(data.freshness < 30)
{

value -= 15;
reaction="URGENCY_ADJUSTMENT";

}


if(value<0)
value=0;


return {

newValue:value,

reaction

};

}


module.exports={
react
};

JS




cat > services/assets/src/marketbrain/marketReactionBrainEngine.js <<'JS'


const signal =
require("./marketSignalEngine");

const prediction =
require("./demandPredictionEngine");

const value =
require("./valueReactionEngine");

const {pool}=require("../postgres");



async function analyze(assetId,data){


const storedSignal =
await signal.record({

assetId,

signal:
"MARKET_CHANGE",

context:data,

impact:data.impact || 50

});



const forecast =
prediction.predict(data);



const valuation =
value.react(data);



await pool.query(
`
INSERT INTO food_brain_market_predictions
(
asset_id,
prediction,
reasoning,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
forecast.prediction,
JSON.stringify(data),
forecast.confidence
]
);



await pool.query(
`
INSERT INTO food_brain_value_reactions
(
asset_id,
previous_value,
new_value,
reaction
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
data.value || 50,
valuation.newValue,
valuation.reaction
]
);



return {

asset_id:assetId,

signal:storedSignal,

market_prediction:forecast,

value_reaction:valuation

};


}



module.exports={
analyze
};

JS




echo "=== Creating market route ==="


cat > services/assets/src/routes/brainMarketRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const brain =
require("../marketbrain/marketReactionBrainEngine");



router.post(
"/market/pulse/:assetId",
async(req,res)=>{

try{

res.json(
await brain.analyze(
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





echo "=== Register market route ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainMarketRoutes" not in text:

 text=text.replace(
 'const brainExecutionRoutes = require("./routes/brainExecutionRoutes");',
 '''const brainExecutionRoutes = require("./routes/brainExecutionRoutes");

const brainMarketRoutes = require("./routes/brainMarketRoutes");'''
 )


if 'app.use("/brain", brainMarketRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainExecutionRoutes);',
 '''app.use("/brain", brainExecutionRoutes);

app.use("/brain", brainMarketRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 29 modules ==="


node - <<'NODE'

require("./services/assets/src/marketbrain/marketSignalEngine");

require("./services/assets/src/marketbrain/demandPredictionEngine");

require("./services/assets/src/marketbrain/valueReactionEngine");

require("./services/assets/src/marketbrain/marketReactionBrainEngine");


console.log(
"Layer 29 market reaction intelligence loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 29 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test market pulse"
echo "3. commit + tag"


