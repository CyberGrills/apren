#!/bin/bash
set -e

echo "=== āprən Food Brain Simulation Intelligence Layer 38 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer38-simulation

cp -r services/assets/src \
backups/layer38-simulation/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating simulation database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_simulations
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

scenario TEXT,

inputs JSONB,

predicted_outcome JSONB,

score NUMERIC DEFAULT 0,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_simulation_asset
ON food_brain_simulations(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_simulation_results
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

selected_scenario TEXT,

reason JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_simulation_results_asset
ON food_brain_simulation_results(asset_id);



SQL



echo "=== Creating simulation engines ==="


mkdir -p services/assets/src/simulation



cat > services/assets/src/simulation/scenarioGenerator.js <<'JS'


function generate(data){


return [

{
name:"SELL_NOW",

description:"Immediate distribution",

freshness:data.freshness,

risk:"LOW_DELAY"
},


{
name:"WAIT",

description:"Hold asset temporarily",

freshness:data.freshness - 20,

risk:"FRESHNESS_LOSS"
},


{
name:"REDIRECT",

description:"Move asset to higher demand",

freshness:data.freshness,

risk:"TRANSPORT_COST"
}


];


}


module.exports={
generate
};


JS





cat > services/assets/src/simulation/outcomeSimulator.js <<'JS'


function simulate(scenario,data){


let value=data.value || 50;

let score=50;



if(scenario.name==="SELL_NOW"){

value += 5;

score += 20;

}



if(scenario.name==="WAIT"){

value -= 15;

score -= 20;

}



if(scenario.name==="REDIRECT"){

value += 20;

score += 30;

}



if(data.demand==="HIGH"){

score += 15;

}



if(scenario.freshness < 20){

score -= 25;

}



return {

scenario:scenario.name,

predicted_value:value,

score,

reason:scenario.description

};


}


module.exports={
simulate
};


JS






cat > services/assets/src/simulation/simulationBrain.js <<'JS'


const generator =
require("./scenarioGenerator");

const simulator =
require("./outcomeSimulator");


const {pool}=require("../postgres");



async function simulate(assetId,data){


const scenarios =
generator.generate(data);


let results=[];


for(const scenario of scenarios){


const outcome =
simulator.simulate(
scenario,
data
);


results.push(outcome);



await pool.query(
`
INSERT INTO food_brain_simulations
(
asset_id,
scenario,
inputs,
predicted_outcome,
score,
confidence
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
assetId,
scenario.name,
JSON.stringify(data),
JSON.stringify(outcome),
outcome.score,
Math.min(outcome.score,100)
]
);


}



results.sort(
(a,b)=>b.score-a.score
);



const winner=results[0];



await pool.query(
`
INSERT INTO food_brain_simulation_results
(
asset_id,
selected_scenario,
reason
)

VALUES($1,$2,$3)
`,
[
assetId,
winner.scenario,
JSON.stringify(winner)
]
);



return {

asset_id:assetId,

simulations:results,

recommended_path:winner

};


}



module.exports={
simulate
};


JS





echo "=== Creating simulation route ==="


cat > services/assets/src/routes/brainSimulationRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const brain =
require("../simulation/simulationBrain");



router.post(
"/simulate/:assetId",
async(req,res)=>{

try{

res.json(
await brain.simulate(
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





echo "=== Register simulation route ==="



python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainSimulationRoutes" not in text:

 text=text.replace(
 'const brainAgentRoutes = require("./routes/brainAgentRoutes");',
 '''const brainAgentRoutes = require("./routes/brainAgentRoutes");

const brainSimulationRoutes = require("./routes/brainSimulationRoutes");'''
 )


if 'app.use("/brain", brainSimulationRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainAgentRoutes);',
 '''app.use("/brain", brainAgentRoutes);

app.use("/brain", brainSimulationRoutes);'''
 )


p.write_text(text)

PY





echo "=== Testing Layer 38 modules ==="


node - <<'NODE'

require("./services/assets/src/simulation/scenarioGenerator");

require("./services/assets/src/simulation/outcomeSimulator");

require("./services/assets/src/simulation/simulationBrain");


console.log(
"Layer 38 simulation intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 38 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test simulation brain"
echo "3. commit + tag"


