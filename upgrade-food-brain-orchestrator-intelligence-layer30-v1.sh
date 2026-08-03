#!/bin/bash
set -e

echo "=== āprən Food Brain Orchestrator Intelligence Layer 30 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer30-orchestrator

cp -r services/assets/src \
backups/layer30-orchestrator/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating orchestrator database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_orchestrator_cycles
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

cycle_input JSONB,

market_result JSONB,

agent_result JSONB,

negotiation_result JSONB,

action_result JSONB,

execution_result JSONB,

confidence NUMERIC DEFAULT 0,

status TEXT DEFAULT 'RUNNING',

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_orchestrator_asset
ON food_brain_orchestrator_cycles(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_learning_feedback
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

previous_action TEXT,

result JSONB,

learning_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_learning_feedback_asset
ON food_brain_learning_feedback(asset_id);



SQL



echo "=== Creating orchestrator engines ==="


mkdir -p services/assets/src/orchestrator



cat > services/assets/src/orchestrator/signalCollectorEngine.js <<'JS'

async function collect(data){

return {

market:true,

agent:true,

negotiation:true,

autonomy:true,

execution:true,

input:data

};

}


module.exports={
collect
};

JS



cat > services/assets/src/orchestrator/decisionCoordinatorEngine.js <<'JS'


function coordinate(
market,
negotiation,
action
){


return {

decision:
action?.autonomous_plan?.action
||
negotiation?.consensus?.decision
||
market?.market_prediction?.prediction
||
"MONITOR",


confidence:
action?.autonomous_plan?.confidence
||
negotiation?.consensus?.confidence
||
market?.market_prediction?.confidence
||
50

};


}



module.exports={
coordinate
};

JS



cat > services/assets/src/orchestrator/learningFeedbackEngine.js <<'JS'

const {pool}=require("../postgres");


async function learn(data){


await pool.query(
`
INSERT INTO food_brain_learning_feedback
(
asset_id,
previous_action,
result,
learning_score
)

VALUES($1,$2,$3,$4)
`,
[
data.assetId,
data.action,
JSON.stringify(data.result),
data.score
]
);


return true;

}



module.exports={
learn
};

JS



cat > services/assets/src/orchestrator/foodBrainOrchestrator.js <<'JS'


const market =
require("../marketbrain/marketReactionBrainEngine");

const negotiation =
require("../negotiation/agentNegotiationBrainEngine");

const autonomy =
require("../autonomy/autonomousBrainEngine");

const execution =
require("../execution/executionGatewayEngine");

const coordinator =
require("./decisionCoordinatorEngine");

const learner =
require("./learningFeedbackEngine");

const {pool}=require("../postgres");



async function orchestrate(assetId,data){


const marketResult =
await market.analyze(
assetId,
data
);



const negotiationResult =
await negotiation.negotiate(
assetId,
data
);



const actionResult =
await autonomy.decide(
assetId,
data
);



const decision =
coordinator.coordinate(
marketResult,
negotiationResult,
actionResult
);



let executionResult =
{
status:"WAITING_APPROVAL"
};



if(data.approved===true){

executionResult =
await execution.execute(
assetId,
{
action:decision.decision,
approved:true,
confidence:decision.confidence
}
);

}



await learner.learn({

assetId,

action:decision.decision,

result:executionResult,

score:decision.confidence

});



const cycle =
await pool.query(
`
INSERT INTO food_brain_orchestrator_cycles
(
asset_id,
cycle_input,
market_result,
negotiation_result,
action_result,
execution_result,
confidence,
status
)

VALUES($1,$2,$3,$4,$5,$6,$7,$8)

RETURNING *
`,
[
assetId,
JSON.stringify(data),
JSON.stringify(marketResult),
JSON.stringify(negotiationResult),
JSON.stringify(actionResult),
JSON.stringify(executionResult),
decision.confidence,
"COMPLETE"
]
);



return {

asset_id:assetId,

brain_status:"COMPLETE",

decision,

market:marketResult,

negotiation:negotiationResult,

action:actionResult,

execution:executionResult,

cycle:cycle.rows[0]

};


}



module.exports={
orchestrate
};

JS



echo "=== Creating orchestrator route ==="



cat > services/assets/src/routes/brainOrchestratorRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const brain =
require("../orchestrator/foodBrainOrchestrator");



router.post(
"/orchestrate/:assetId",
async(req,res)=>{

try{

res.json(
await brain.orchestrate(
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




echo "=== Register orchestrator route ==="



python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainOrchestratorRoutes" not in text:

 text=text.replace(
 'const brainMarketRoutes = require("./routes/brainMarketRoutes");',
 '''const brainMarketRoutes = require("./routes/brainMarketRoutes");

const brainOrchestratorRoutes = require("./routes/brainOrchestratorRoutes");'''
 )


if 'app.use("/brain", brainOrchestratorRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainMarketRoutes);',
 '''app.use("/brain", brainMarketRoutes);

app.use("/brain", brainOrchestratorRoutes);'''
 )


p.write_text(text)

PY




echo "=== Testing Layer 30 modules ==="



node - <<'NODE'

require("./services/assets/src/orchestrator/signalCollectorEngine");

require("./services/assets/src/orchestrator/decisionCoordinatorEngine");

require("./services/assets/src/orchestrator/learningFeedbackEngine");

require("./services/assets/src/orchestrator/foodBrainOrchestrator");


console.log(
"Layer 30 food brain orchestrator loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 30 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test full brain cycle"
echo "3. commit + tag"

