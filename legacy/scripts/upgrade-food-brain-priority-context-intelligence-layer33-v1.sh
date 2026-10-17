#!/bin/bash
set -e

echo "=== āprən Food Brain Priority Context Intelligence Layer 33 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer33-priority-context

cp -r services/assets/src \
backups/layer33-priority-context/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating priority intelligence database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_priority_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

winning_signal TEXT,

priority_score NUMERIC DEFAULT 0,

decision TEXT,

reasoning JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_priority_decision_asset
ON food_brain_priority_decisions(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_context_history
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

context JSONB,

decision TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_context_history_asset
ON food_brain_context_history(asset_id);



SQL



echo "=== Creating priority engines ==="


mkdir -p services/assets/src/priority



cat > services/assets/src/priority/contextPriorityEngine.js <<'JS'


function evaluate(data){


let winner="MONITOR";
let score=20;
let reason=[];



if(data.freshness < 15){

winner="FRESHNESS_CRITICAL";
score=100;

reason.push(
"immediate freshness danger"
);

}


else if(data.freshness < 30){

winner="FRESHNESS_RISK";
score=90;

reason.push(
"freshness declining"
);

}



if(data.wasteRisk==="HIGH"){

winner="WASTE_PREVENTION";
score=Math.max(score,95);

reason.push(
"waste probability high"
);

}



if(data.demand==="HIGH" && score < 90){

winner="DEMAND_OPPORTUNITY";
score=70;

reason.push(
"demand opportunity"
);

}



if(data.valueRisk==="HIGH" && score < 70){

winner="VALUE_PROTECTION";
score=60;

reason.push(
"value protection"
);

}



return {

priority:winner,

score,

reason

};

}



module.exports={
evaluate
};

JS





cat > services/assets/src/priority/priorityDecisionBrain.js <<'JS'


const priority =
require("./contextPriorityEngine");

const {pool}=require("../postgres");



async function decide(assetId,data){


const decision =
priority.evaluate(data);



await pool.query(
`
INSERT INTO food_brain_priority_decisions
(
asset_id,
winning_signal,
priority_score,
decision,
reasoning,
confidence
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
assetId,
decision.priority,
decision.score,
decision.priority,
JSON.stringify(decision.reason),
decision.score
]
);



return {

asset_id:assetId,

priority_decision:decision

};


}



module.exports={
decide
};

JS




echo "=== Creating priority route ==="



cat > services/assets/src/routes/brainPriorityRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const brain =
require("../priority/priorityDecisionBrain");



router.post(
"/priority/:assetId",
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





echo "=== Register priority route ==="



python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainPriorityRoutes" not in text:

 text=text.replace(
 'const brainPredictionRoutes = require("./routes/brainPredictionRoutes");',
 '''const brainPredictionRoutes = require("./routes/brainPredictionRoutes");

const brainPriorityRoutes = require("./routes/brainPriorityRoutes");'''
 )


if 'app.use("/brain", brainPriorityRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainPredictionRoutes);',
 '''app.use("/brain", brainPredictionRoutes);

app.use("/brain", brainPriorityRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 33 modules ==="


node - <<'NODE'

require("./services/assets/src/priority/contextPriorityEngine");

require("./services/assets/src/priority/priorityDecisionBrain");


console.log(
"Layer 33 priority intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 33 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test priority brain"
echo "3. commit + tag"

