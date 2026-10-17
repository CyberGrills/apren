#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Action Engine Layer 27 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer27-autonomous-action

cp -r services/assets/src \
backups/layer27-autonomous-action/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating autonomous action database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_action_plans
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

priority NUMERIC DEFAULT 0,

reasoning JSONB,

confidence NUMERIC DEFAULT 0,

requires_approval BOOLEAN DEFAULT TRUE,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_action_plans_asset
ON food_brain_action_plans(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_action_history
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

result JSONB,

success_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_action_history_asset
ON food_brain_action_history(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_execution_results
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

plan_id INTEGER,

execution JSONB,

status TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_execution_asset
ON food_brain_execution_results(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_autonomous_rules
(
id SERIAL PRIMARY KEY,

rule_name TEXT,

condition JSONB,

allowed_action TEXT,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



SQL



echo "=== Creating autonomous engines ==="


mkdir -p services/assets/src/autonomy



cat > services/assets/src/autonomy/actionPriorityEngine.js <<'JS'

function calculate(data){

let priority=50;


if(data.freshness < 30){

priority += 25;

}


if(data.demand==="HIGH"){

priority += 20;

}


if(data.supply==="LOW"){

priority += 10;

}


if(priority>100){

priority=100;

}


return priority;

}


module.exports={
calculate
};

JS




cat > services/assets/src/autonomy/actionPlannerEngine.js <<'JS'

const priority =
require("./actionPriorityEngine");


function plan(data){


const score =
priority.calculate(data);


let action="MONITOR";


let reasons=[];



if(data.freshness < 30){

action="DISTRIBUTE_FAST";

reasons.push(
"freshness decay risk"
);

}



if(data.demand==="HIGH"){

reasons.push(
"high demand opportunity"
);

}



if(data.supply==="LOW"){

reasons.push(
"supply pressure"
);

}



return {

action,

priority:score,

reasoning:reasons,

confidence:score,

requiresApproval:true

};


}



module.exports={
plan
};

JS





cat > services/assets/src/autonomy/actionConfidenceEngine.js <<'JS'


function evaluate(plan){


let confidence =
plan.confidence;


if(plan.reasoning.length>=2){

confidence +=5;

}


if(confidence>100){

confidence=100;

}


return confidence;

}


module.exports={
evaluate
};

JS





cat > services/assets/src/autonomy/executionMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_action_history
(
asset_id,
action,
result,
success_score
)

VALUES($1,$2,$3,$4)

RETURNING *
`,
[
data.assetId,
data.action,
JSON.stringify(data.result),
data.score
]
);


return result.rows[0];

}



module.exports={
remember
};

JS






cat > services/assets/src/autonomy/autonomousBrainEngine.js <<'JS'


const planner =
require("./actionPlannerEngine");

const confidence =
require("./actionConfidenceEngine");

const memory =
require("./executionMemoryEngine");

const {pool}=require("../postgres");



async function decide(assetId,data){


let plan =
planner.plan(data);



plan.confidence =
confidence.evaluate(plan);



const saved =
await pool.query(
`
INSERT INTO food_brain_action_plans
(
asset_id,
action,
priority,
reasoning,
confidence,
requires_approval
)

VALUES($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
plan.action,
plan.priority,
JSON.stringify(plan.reasoning),
plan.confidence,
true
]
);



return {

asset_id:assetId,

autonomous_plan:saved.rows[0],

message:
"Action planned. Approval required before execution."

};


}



module.exports={
decide
};

JS




echo "=== Creating autonomous route ==="


cat > services/assets/src/routes/brainAutonomousRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const brain =
require("../autonomy/autonomousBrainEngine");



router.post(
"/autonomous/action/:assetId",
async(req,res)=>{

try{

res.json(
await brain.decide(
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





echo "=== Register autonomous routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainAutonomousRoutes" not in text:

 text=text.replace(
 'const brainNegotiationRoutes = require("./routes/brainNegotiationRoutes");',
 '''const brainNegotiationRoutes = require("./routes/brainNegotiationRoutes");

const brainAutonomousRoutes = require("./routes/brainAutonomousRoutes");'''
 )



if 'app.use("/brain", brainAutonomousRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainNegotiationRoutes);',
 '''app.use("/brain", brainNegotiationRoutes);

app.use("/brain", brainAutonomousRoutes);'''
 )


p.write_text(text)

PY





echo "=== Testing Layer 27 modules ==="


node - <<'NODE'

require("./services/assets/src/autonomy/actionPriorityEngine");

require("./services/assets/src/autonomy/actionPlannerEngine");

require("./services/assets/src/autonomy/actionConfidenceEngine");

require("./services/assets/src/autonomy/autonomousBrainEngine");


console.log(
"Layer 27 autonomous action intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 27 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test autonomous brain"
echo "3. commit + tag"


