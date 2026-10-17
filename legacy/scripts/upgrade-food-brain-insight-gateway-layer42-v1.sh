#!/bin/bash
set -e

echo "=== āprən Food Brain Insight Gateway Layer 42 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer42-insight-gateway

cp -r services/assets/src \
backups/layer42-insight-gateway/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating insight gateway database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_insights
(
id SERIAL PRIMARY KEY,

asset_id INTEGER,

insight_type TEXT,

insight JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_brain_insights_asset
ON food_brain_insights(asset_id);



SQL



echo "=== Creating insight gateway engine ==="


mkdir -p services/assets/src/gateway



cat > services/assets/src/gateway/foodBrainInsightGateway.js <<'JS'


const prediction =
require("../prediction/predictiveBrain");

const simulation =
require("../simulation/simulationBrain");

const memory =
require("../memory/brainExperienceEngine");

const agents =
require("../agents/agentCollaborationEngine");

const {pool}=require("../postgres");



async function insight(assetId,data){


const brainPrediction =
await prediction.predict(
assetId,
data
);



const brainSimulation =
await simulation.simulate(
assetId,
data
);



const brainMemory =
await memory.learn(
assetId
);



const brainAgents =
await agents.collaborate(
assetId,
data
);



const response = {


asset_id:assetId,


brain_status:"ACTIVE",



freshness:{

prediction:
brainPrediction.prediction.future_state[1]

},



market:{

prediction:
brainPrediction.prediction.future_state[0]

},



value:{

prediction:
brainPrediction.prediction.future_state[2]

},



recommended_action:
brainSimulation.recommended_path,



agent_consensus:
brainAgents.consensus,



experience:
brainMemory.experience


};



await pool.query(
`
INSERT INTO food_brain_insights
(
asset_id,
insight_type,
insight,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
"FOOD_BRAIN_SUMMARY",
JSON.stringify(response),
response.agent_consensus.confidence
]
);



return response;


}



module.exports={
insight
};


JS




echo "=== Creating gateway route ==="


cat > services/assets/src/routes/brainInsightRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const gateway =
require("../gateway/foodBrainInsightGateway");



router.post(
"/insight/:assetId",
async(req,res)=>{


try{


res.json(
await gateway.insight(
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




echo "=== Register insight gateway ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainInsightRoutes" not in text:

 text=text.replace(
 'const brainMemoryRoutes = require("./routes/brainMemoryRoutes");',
 '''const brainMemoryRoutes = require("./routes/brainMemoryRoutes");

const brainInsightRoutes = require("./routes/brainInsightRoutes");'''
 )


if 'app.use("/brain", brainInsightRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainMemoryRoutes);',
 '''app.use("/brain", brainMemoryRoutes);

app.use("/brain", brainInsightRoutes);'''
 )


p.write_text(text)

PY




echo "=== Testing Layer 42 modules ==="


node - <<'NODE'

require("./services/assets/src/gateway/foodBrainInsightGateway");

console.log(
"Layer 42 Food Brain Insight Gateway loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 42 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test insight gateway"
echo "3. commit + tag"


