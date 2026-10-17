#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Decision Loop Intelligence Layer 36 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer36-autonomous-decision-loop

cp -r services/assets/src \
backups/layer36-autonomous-decision-loop/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating decision loop database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_decision_cycles
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

cycle_stage TEXT,

input_state JSONB,

decision JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_decision_cycles_asset
ON food_brain_decision_cycles(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_decision_feedback
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

decision_id INTEGER,

expected_outcome JSONB,

actual_outcome JSONB,

accuracy_score NUMERIC DEFAULT 0,

improvement_signal JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_decision_feedback_asset
ON food_brain_decision_feedback(asset_id);



SQL



echo "=== Creating autonomous cycle engines ==="


mkdir -p services/assets/src/cycle



cat > services/assets/src/cycle/decisionMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(assetId,stage,input,decision,confidence){

await pool.query(
`
INSERT INTO food_brain_decision_cycles
(
asset_id,
cycle_stage,
input_state,
decision,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
stage,
JSON.stringify(input),
JSON.stringify(decision),
confidence
]
);

}


module.exports={
remember
};

JS




cat > services/assets/src/cycle/cycleFeedbackEngine.js <<'JS'


const {pool}=require("../postgres");


async function feedback(assetId,data){


await pool.query(
`
INSERT INTO food_brain_decision_feedback
(
asset_id,
expected_outcome,
actual_outcome,
accuracy_score,
improvement_signal
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
JSON.stringify(data.expected),
JSON.stringify(data.actual),
data.score || 0,
JSON.stringify(data.signal || {})
]
);


return {

status:"FEEDBACK_RECORDED",

accuracy:data.score || 0

};


}


module.exports={
feedback
};


JS





cat > services/assets/src/cycle/decisionLoopEngine.js <<'JS'


const memory =
require("./decisionMemoryEngine");


const priority =
require("../priority/contextPriorityEngine");


const strategy =
require("../strategy/actionStrategyEngine");


const risk =
require("../strategy/riskRewardEngine");



async function run(assetId,data){


const priorityResult =
priority.evaluate(data);



const riskResult =
risk.evaluate(data);



const strategyResult =
strategy.create(
data,
riskResult
);



const decision={

action:strategyResult.strategy,

priority:priorityResult.priority,

steps:strategyResult.steps

};



await memory.remember(
assetId,
"DECISION",
data,
decision,
Math.max(
priorityResult.score,
riskResult.reward
)
);



return {

decision,

priority:priorityResult,

risk:riskResult,

strategy:strategyResult

};


}



module.exports={
run
};


JS






cat > services/assets/src/cycle/brainCycleController.js <<'JS'


const decisionLoop =
require("./decisionLoopEngine");


const feedback =
require("./cycleFeedbackEngine");


async function execute(assetId,data){


const decision =
await decisionLoop.run(
assetId,
data
);



return {

cycle:"COMPLETE",

asset_id:assetId,

decision,

feedback_ready:true

};


}



module.exports={
execute
};


JS





echo "=== Creating decision loop route ==="


cat > services/assets/src/routes/brainCycleRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const brain =
require("../cycle/brainCycleController");

const feedback =
require("../cycle/cycleFeedbackEngine");



router.post(
"/cycle/:assetId",
async(req,res)=>{

try{

res.json(
await brain.execute(
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



router.post(
"/cycle-feedback/:assetId",
async(req,res)=>{

try{

res.json(
await feedback.feedback(
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





echo "=== Register decision loop route ==="



python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainCycleRoutes" not in text:

 text=text.replace(
 'const brainOptimizationRoutes = require("./routes/brainOptimizationRoutes");',
 '''const brainOptimizationRoutes = require("./routes/brainOptimizationRoutes");

const brainCycleRoutes = require("./routes/brainCycleRoutes");'''
 )


if 'app.use("/brain", brainCycleRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainOptimizationRoutes);',
 '''app.use("/brain", brainOptimizationRoutes);

app.use("/brain", brainCycleRoutes);'''
 )


p.write_text(text)

PY





echo "=== Testing Layer 36 modules ==="


node - <<'NODE'

require("./services/assets/src/cycle/decisionMemoryEngine");

require("./services/assets/src/cycle/cycleFeedbackEngine");

require("./services/assets/src/cycle/decisionLoopEngine");

require("./services/assets/src/cycle/brainCycleController");


console.log(
"Layer 36 autonomous decision loop intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 36 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test autonomous cycle"
echo "3. commit + tag"


