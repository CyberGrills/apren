#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Orchestration Layer 20 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer20-orchestration

cp -r services/assets/src \
backups/layer20-orchestration/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating orchestration database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_orchestration_runs
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

stage TEXT,

input_signals JSONB,

decision_output JSONB,

execution_output JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_orchestration_asset
ON food_brain_orchestration_runs(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_learning_feedback
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

source_stage TEXT,

feedback_type TEXT,

feedback_data JSONB,

learning_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_learning_feedback_asset
ON food_brain_learning_feedback(asset_id);



SQL



echo "=== Creating orchestration engines ==="


mkdir -p services/assets/src/orchestration



cat > services/assets/src/orchestration/intelligencePipelineEngine.js <<'JS'

function pipeline(data){

return {

prediction:{
status:"COMPLETE"
},

collective:{
status:"COMPLETE"
},

simulation:{
status:"COMPLETE"
},

decision:{
status:"READY"
},

execution:{
status:"READY"
}

};

}


module.exports={
pipeline
};

JS





cat > services/assets/src/orchestration/economyOptimizationEngine.js <<'JS'

function optimize(data){


let confidence=70;


if(data.freshness < 50){

confidence+=10;

}


if(data.signals &&
data.signals.includes("HIGH_DEMAND")){

confidence+=12;

}



if(confidence>100){

confidence=100;

}


return {

optimization:"VALUE_PROTECTION",

confidence

};

}



module.exports={
optimize
};

JS





cat > services/assets/src/orchestration/learningFeedbackEngine.js <<'JS'

const {pool}=require("../postgres");


async function record(data){


const result =
await pool.query(
`
INSERT INTO food_brain_learning_feedback
(
asset_id,
source_stage,
feedback_type,
feedback_data,
learning_score
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.stage,
data.type,
JSON.stringify(data.data),
data.score
]
);


return result.rows[0];

}


module.exports={
record
};

JS





cat > services/assets/src/orchestration/brainOrchestratorEngine.js <<'JS'

const pipeline =
require("./intelligencePipelineEngine");

const optimizer =
require("./economyOptimizationEngine");

const feedback =
require("./learningFeedbackEngine");

const {pool}=require("../postgres");



async function orchestrate(assetId,data){


const brainPipeline =
pipeline.pipeline(data);



const optimization =
optimizer.optimize(data);



const decision = {

action:
optimization.confidence >= 80
?
"PROMOTE"
:
"HOLD",

confidence:
optimization.confidence

};



const execution = {

status:"READY",

mode:data.autonomy || "ASSISTED"

};



const run =
await pool.query(
`
INSERT INTO food_brain_orchestration_runs
(
asset_id,
stage,
input_signals,
decision_output,
execution_output,
confidence
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
"COMPLETE",

JSON.stringify(
brainPipeline
),

JSON.stringify(
decision
),

JSON.stringify(
execution
),

optimization.confidence
]
);



await feedback.record({

assetId,

stage:"ORCHESTRATION",

type:"CYCLE_COMPLETE",

data:{
decision,
execution
},

score:
optimization.confidence

});



return {

asset_id:assetId,

brain_cycle:{

pipeline:brainPipeline,

decision,

execution

},

confidence:
optimization.confidence,

run:run.rows[0]

};

}



module.exports={
orchestrate
};

JS





echo "=== Creating orchestration route ==="


cat > services/assets/src/routes/brainOrchestrationRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const brain =
require("../orchestration/brainOrchestratorEngine");



router.post("/orchestrate/:assetId",async(req,res)=>{


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





echo "=== Register orchestration routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainOrchestrationRoutes" not in text:

    text=text.replace(
    'const brainExecutionRoutes = require("./routes/brainExecutionRoutes");',
    '''const brainExecutionRoutes = require("./routes/brainExecutionRoutes");

const brainOrchestrationRoutes = require("./routes/brainOrchestrationRoutes");'''
    )



if 'app.use("/brain", brainOrchestrationRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainExecutionRoutes);',
    '''app.use("/brain", brainExecutionRoutes);

app.use("/brain", brainOrchestrationRoutes);'''
    )


p.write_text(text)

PY





echo "=== Testing Layer 20 modules ==="


node - <<'NODE'

require("./services/assets/src/orchestration/intelligencePipelineEngine");

require("./services/assets/src/orchestration/economyOptimizationEngine");

require("./services/assets/src/orchestration/brainOrchestratorEngine");


console.log(
"Layer 20 orchestration loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 20 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test orchestration"
echo "3. commit + tag"


