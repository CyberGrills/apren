#!/bin/bash
set -e

echo "=== āprən Food Brain Predictive World Model Layer 22 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer22-predictive-world-model

cp -r services/assets/src \
backups/layer22-predictive-world-model/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating world model database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_world_states
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

region TEXT,

state_data JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_world_state_asset
ON food_brain_world_states(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_future_scenarios
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

scenario_name TEXT,

future_state JSONB,

predicted_value NUMERIC,

risk_level TEXT,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_future_scenario_asset
ON food_brain_future_scenarios(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_forecasts
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

forecast_type TEXT,

prediction JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_forecast_asset
ON food_brain_forecasts(asset_id);



SQL



echo "=== Creating world model engines ==="


mkdir -p services/assets/src/worldmodel



cat > services/assets/src/worldmodel/stateBuilderEngine.js <<'JS'

function build(data){

return {

freshness:data.freshness || 0,

demand:data.demand || "NORMAL",

supply:data.supply || "NORMAL",

market:data.market || {},

timestamp:new Date()

};

}


module.exports={
build
};

JS



cat > services/assets/src/worldmodel/scenarioPredictionEngine.js <<'JS'

function predict(state){


let scenarios=[];


let baseValue =
state.market.value || 0;



scenarios.push({

name:"SELL_NOW",

value:
baseValue,

risk:"LOW"

});



scenarios.push({

name:"WAIT",

value:
baseValue *
0.75,

risk:
state.freshness < 40
?
"HIGH"
:
"MEDIUM"

});



if(state.demand==="HIGH"){

scenarios.push({

name:"PROMOTE",

value:
baseValue * 1.20,

risk:"LOW"

});

}



return scenarios;

}


module.exports={
predict
};

JS



cat > services/assets/src/worldmodel/futureMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(data){

const result =
await pool.query(
`
INSERT INTO food_brain_future_scenarios
(
asset_id,
scenario_name,
future_state,
predicted_value,
risk_level,
confidence
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.assetId,
data.name,
JSON.stringify(data.state),
data.value,
data.risk,
data.confidence
]
);


return result.rows[0];

}


module.exports={
remember
};

JS



cat > services/assets/src/worldmodel/worldModelEngine.js <<'JS'

const state =
require("./stateBuilderEngine");

const predictor =
require("./scenarioPredictionEngine");

const memory =
require("./futureMemoryEngine");



async function imagine(assetId,data){


const world =
state.build(data);


const futures =
predictor.predict(world);



const saved=[];


for(const future of futures){

saved.push(
await memory.remember({

assetId,

name:
future.name,

state:
world,

value:
future.value,

risk:
future.risk,

confidence:85

})
);

}



return {

asset_id:assetId,

current_world:world,

future_scenarios:saved

};

}



module.exports={
imagine
};

JS



echo "=== Creating world model routes ==="


cat > services/assets/src/routes/brainWorldModelRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const world =
require("../worldmodel/worldModelEngine");


router.post("/world-model/:assetId",async(req,res)=>{

try{

res.json(
await world.imagine(
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



echo "=== Register routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainWorldModelRoutes" not in text:

 text=text.replace(
 'const brainLearningRoutes = require("./routes/brainLearningRoutes");',
 '''const brainLearningRoutes = require("./routes/brainLearningRoutes");

const brainWorldModelRoutes = require("./routes/brainWorldModelRoutes");'''
 )



if 'app.use("/brain", brainWorldModelRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainLearningRoutes);',
 '''app.use("/brain", brainLearningRoutes);

app.use("/brain", brainWorldModelRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 22 modules ==="


node - <<'NODE'

require("./services/assets/src/worldmodel/stateBuilderEngine");

require("./services/assets/src/worldmodel/scenarioPredictionEngine");

require("./services/assets/src/worldmodel/worldModelEngine");

console.log(
"Layer 22 predictive world model loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 22 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test world model"
echo "3. commit + tag"

