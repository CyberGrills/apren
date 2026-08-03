#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Strategy Intelligence Layer 34 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer34-autonomous-strategy

cp -r services/assets/src \
backups/layer34-autonomous-strategy/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating strategy database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_strategies
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

strategy_type TEXT,

strategy JSONB,

expected_result JSONB,

risk_score NUMERIC DEFAULT 0,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_strategy_asset
ON food_brain_strategies(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_strategy_history
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

previous_strategy JSONB,

outcome JSONB,

success_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_strategy_history_asset
ON food_brain_strategy_history(asset_id);



SQL



echo "=== Creating strategy engines ==="


mkdir -p services/assets/src/strategy



cat > services/assets/src/strategy/riskRewardEngine.js <<'JS'


function evaluate(data){

let risk=30;
let reward=50;


if(data.demand==="HIGH"){
reward+=30;
}


if(data.freshness < 20){
risk+=40;
}


if(data.supply==="LOW"){
reward+=20;
}


if(risk>100)
risk=100;


if(reward>100)
reward=100;


return {

risk,
reward,

balance:
reward-risk

};

}


module.exports={
evaluate
};

JS



cat > services/assets/src/strategy/actionStrategyEngine.js <<'JS'


function create(data,analysis){


let strategy="MONITOR";

let steps=[];



if(data.freshness < 20){

strategy="FAST_DISTRIBUTION";

steps.push(
"move asset before freshness loss"
);

steps.push(
"activate nearby demand"
);

}



if(data.demand==="HIGH"){

steps.push(
"increase market visibility"
);

}



if(analysis.balance > 50){

steps.push(
"maximize asset value"
);

}



return {

strategy,

steps

};

}


module.exports={
create
};

JS



cat > services/assets/src/strategy/autonomousStrategyBrain.js <<'JS'


const riskReward =
require("./riskRewardEngine");

const strategy =
require("./actionStrategyEngine");

const {pool}=require("../postgres");



async function generate(assetId,data){


const evaluation =
riskReward.evaluate(data);


const plan =
strategy.create(
data,
evaluation
);



await pool.query(
`
INSERT INTO food_brain_strategies
(
asset_id,
strategy_type,
strategy,
expected_result,
risk_score,
confidence
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
assetId,
plan.strategy,
JSON.stringify(plan.steps),
JSON.stringify(evaluation),
evaluation.risk,
Math.abs(evaluation.balance)
]
);



return {

asset_id:assetId,

strategy:plan,

evaluation

};


}



module.exports={
generate
};

JS



echo "=== Creating strategy route ==="


cat > services/assets/src/routes/brainStrategyRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const brain =
require("../strategy/autonomousStrategyBrain");


router.post(
"/strategy/:assetId",
async(req,res)=>{

try{

res.json(
await brain.generate(
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



echo "=== Register strategy route ==="



python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainStrategyRoutes" not in text:

 text=text.replace(
 'const brainPriorityRoutes = require("./routes/brainPriorityRoutes");',
 '''const brainPriorityRoutes = require("./routes/brainPriorityRoutes");

const brainStrategyRoutes = require("./routes/brainStrategyRoutes");'''
 )


if 'app.use("/brain", brainStrategyRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainPriorityRoutes);',
 '''app.use("/brain", brainPriorityRoutes);

app.use("/brain", brainStrategyRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 34 modules ==="


node - <<'NODE'

require("./services/assets/src/strategy/riskRewardEngine");

require("./services/assets/src/strategy/actionStrategyEngine");

require("./services/assets/src/strategy/autonomousStrategyBrain");

console.log(
"Layer 34 autonomous strategy intelligence loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 34 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test strategy brain"
echo "3. commit + tag"

