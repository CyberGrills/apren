#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Orchestrator Core Layer 40 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer40-orchestrator

cp -r services/assets/src \
backups/layer40-orchestrator/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating orchestrator database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_orchestrator_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER,

input_state JSONB,

intelligence_chain JSONB,

final_decision JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_orchestrator_asset
ON food_brain_orchestrator_decisions(asset_id);



SQL



echo "=== Creating orchestrator engine ==="


mkdir -p services/assets/src/orchestrator



cat > services/assets/src/orchestrator/foodBrainOrchestrator.js <<'JS'


const prediction =
require("../prediction/predictiveBrain");

const simulation =
require("../simulation/simulationBrain");

const agents =
require("../agents/agentCollaborationEngine");

const cycle =
require("../cycle/decisionLoopEngine");

const strategy =
require("../strategy/actionStrategyEngine");

const {pool}=require("../postgres");



async function orchestrate(assetId,data){


const predictive =
await prediction.predict(
assetId,
data
);



const simulated =
await simulation.simulate(
assetId,
data
);



const collaboration =
await agents.collaborate(
assetId,
data
);



const decision =
await cycle.run(
assetId,
data
);



const finalStrategy =
strategy.create(
data,
decision.risk
);



let confidence =
Math.round(
(
predictive.prediction.overall_confidence +
collaboration.consensus.confidence
+
simulated.recommended_path.score
) / 3
);



const finalDecision={

action:finalStrategy.strategy,

steps:finalStrategy.steps,

reason:{

prediction:predictive.prediction,

simulation:simulated.recommended_path,

agents:collaboration.consensus,

decision

}

};



await pool.query(
`
INSERT INTO food_brain_orchestrator_decisions
(
asset_id,
input_state,
intelligence_chain,
final_decision,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
JSON.stringify(data),
JSON.stringify({
prediction:true,
simulation:true,
agents:true,
decision:true
}),
JSON.stringify(finalDecision),
confidence
]
);



return {

asset_id:assetId,

brain_status:"AUTONOMOUS",

confidence,

final_decision:finalDecision

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
 'const brainPredictionRoutes = require("./routes/brainPredictionRoutes");',
 '''const brainPredictionRoutes = require("./routes/brainPredictionRoutes");

const brainOrchestratorRoutes = require("./routes/brainOrchestratorRoutes");'''
 )


if 'app.use("/brain", brainOrchestratorRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainPredictionRoutes);',
 '''app.use("/brain", brainPredictionRoutes);

app.use("/brain", brainOrchestratorRoutes);'''
 )


p.write_text(text)

PY





echo "=== Testing Layer 40 modules ==="


node - <<'NODE'

require("./services/assets/src/orchestrator/foodBrainOrchestrator");

console.log(
"Layer 40 autonomous orchestrator intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 40 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test orchestrator brain"
echo "3. commit + tag"


