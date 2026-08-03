#!/bin/bash
set -e

echo "=== āprən Food Brain Market Simulation Layer 17 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer17-market-simulation

cp -r services/assets/src \
backups/layer17-market-simulation/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating simulation database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_market_simulations
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

scenario TEXT,

input_data JSONB,

predicted_outcome JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_market_simulation_asset
ON food_brain_market_simulations(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_simulation_history
(
id SERIAL PRIMARY KEY,

simulation_id INTEGER REFERENCES food_brain_market_simulations(id)
ON DELETE CASCADE,

actual_outcome JSONB,

accuracy NUMERIC,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_simulation_history
ON food_brain_simulation_history(simulation_id);


SQL



echo "=== Creating simulation engines ==="


mkdir -p services/assets/src/simulation



cat > services/assets/src/simulation/scenarioEngine.js <<'JS'

function createScenario(data){

return {

supply_change:data.supplyChange || 0,

demand_change:data.demandChange || 0,

price_change:data.priceChange || 0

};

}


module.exports={
createScenario
};

JS




cat > services/assets/src/simulation/marketSimulationEngine.js <<'JS'

function simulate(data){


let price=data.currentValue || 0;


price += price *
(
(data.demandChange || 0)
-
(data.supplyChange || 0)
+
(data.priceChange || 0)
)
/
100;



if(price < 0){

price=0;

}



let demand="NORMAL";


if((data.demandChange || 0)>20){

demand="HIGH";

}


if((data.demandChange || 0)<-20){

demand="LOW";

}



return {

future_value:Number(price.toFixed(2)),

demand_state:demand

};


}


module.exports={
simulate
};

JS




cat > services/assets/src/simulation/riskSimulationEngine.js <<'JS'

function evaluate(result){


if(result.future_value < 1){

return "HIGH";

}


if(result.demand_state==="LOW"){

return "MEDIUM";

}


return "LOW";

}


module.exports={
evaluate
};

JS





cat > services/assets/src/simulation/marketSimulationMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_market_simulations
(
asset_id,
scenario,
input_data,
predicted_outcome,
confidence
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.scenario,
JSON.stringify(data.input),
JSON.stringify(data.output),
data.confidence
]
);


return result.rows[0];

}


module.exports={
remember
};

JS





cat > services/assets/src/simulation/marketSimulationEngineRunner.js <<'JS'

const scenario =
require("./scenarioEngine");

const simulator =
require("./marketSimulationEngine");

const risk =
require("./riskSimulationEngine");

const memory =
require("./marketSimulationMemoryEngine");



async function run(assetId,data){


const created =
scenario.createScenario(data);


const result =
simulator.simulate(
data
);


const riskLevel =
risk.evaluate(
result
);



return await memory.remember({

assetId,

scenario:riskLevel,

input:created,

output:{
...result,
risk:riskLevel
},

confidence:90

});


}



module.exports={
run
};

JS




echo "=== Creating simulation routes ==="


cat > services/assets/src/routes/brainSimulationRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const simulation =
require("../simulation/marketSimulationEngineRunner");



router.post("/simulation/run/:assetId",async(req,res)=>{


try{

res.json(
await simulation.run(
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





echo "=== Register simulation routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainSimulationRoutes" not in text:

    text=text.replace(
    'const brainCollectiveRoutes = require("./routes/brainCollectiveRoutes");',
    '''const brainCollectiveRoutes = require("./routes/brainCollectiveRoutes");

const brainSimulationRoutes = require("./routes/brainSimulationRoutes");'''
    )


if 'app.use("/brain", brainSimulationRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainCollectiveRoutes);',
    '''app.use("/brain", brainCollectiveRoutes);

app.use("/brain", brainSimulationRoutes);'''
    )


p.write_text(text)

PY



echo "=== Testing Layer 17 modules ==="


node - <<'NODE'

require("./services/assets/src/simulation/scenarioEngine");

require("./services/assets/src/simulation/marketSimulationEngine");

require("./services/assets/src/simulation/marketSimulationEngineRunner");


console.log(
"Layer 17 market simulation loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 17 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test simulation"
echo "3. commit + tag"

