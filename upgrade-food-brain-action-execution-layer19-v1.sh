#!/bin/bash
set -e

echo "=== āprən Food Brain Action Execution Layer 19 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer19-action-execution

cp -r services/assets/src \
backups/layer19-action-execution/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating execution database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_action_plans
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

decision_id INTEGER,

action TEXT,

execution_mode TEXT DEFAULT 'ASSISTED',

status TEXT DEFAULT 'PENDING',

requirements JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_action_plan_asset
ON food_brain_action_plans(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_execution_results
(
id SERIAL PRIMARY KEY,

plan_id INTEGER REFERENCES food_brain_action_plans(id)
ON DELETE CASCADE,

result_status TEXT,

execution_output JSONB,

learning_signal TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_execution_plan
ON food_brain_execution_results(plan_id);



SQL



echo "=== Creating execution engines ==="


mkdir -p services/assets/src/execution



cat > services/assets/src/execution/actionPermissionEngine.js <<'JS'

function check(data){

if(data.executionMode==="AUTONOMOUS"){

return {
allowed:true,
mode:"AUTONOMOUS"
};

}


return {
allowed:true,
mode:"ASSISTED"
};

}


module.exports={
check
};

JS




cat > services/assets/src/execution/actionPlannerEngine.js <<'JS'

function create(data){


return {

assetId:data.assetId,

action:data.action,

requirements:{

wallet:data.action==="TRADE",

market:data.action==="SELL_NOW" ||
data.action==="PROMOTE",

freshnessCheck:true

}

};


}



module.exports={
create
};

JS




cat > services/assets/src/execution/executionMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function plan(data){


const result =
await pool.query(
`
INSERT INTO food_brain_action_plans
(
asset_id,
decision_id,
action,
execution_mode,
requirements
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.decisionId || null,
data.action,
data.mode,
JSON.stringify(data.requirements)
]
);


return result.rows[0];

}





async function result(data){


const output =
await pool.query(
`
INSERT INTO food_brain_execution_results
(
plan_id,
result_status,
execution_output,
learning_signal
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.planId,
data.status,
JSON.stringify(data.output),
data.signal
]
);


return output.rows[0];

}



module.exports={
plan,
result
};

JS





cat > services/assets/src/execution/actionExecutionEngine.js <<'JS'

const permission =
require("./actionPermissionEngine");

const planner =
require("./actionPlannerEngine");

const memory =
require("./executionMemoryEngine");



async function execute(assetId,data){


const access =
permission.check(data);



if(!access.allowed){

throw new Error(
"Execution denied"
);

}



const plan =
planner.create({

assetId,

action:data.action

});



const savedPlan =
await memory.plan({

assetId,

action:data.action,

mode:access.mode,

requirements:plan.requirements

});



const execution = {

status:"SIMULATED_EXECUTION",

message:
"Action execution pipeline ready",

next:
"Connect wallet/trade services"

};



const savedResult =
await memory.result({

planId:savedPlan.id,

status:"SUCCESS",

output:execution,

signal:"POSITIVE"

});



return {

plan:savedPlan,

result:savedResult

};


}



module.exports={
execute
};

JS




echo "=== Creating execution routes ==="


cat > services/assets/src/routes/brainExecutionRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const execution =
require("../execution/actionExecutionEngine");



router.post("/execute/:assetId",async(req,res)=>{


try{


res.json(
await execution.execute(
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





echo "=== Register execution routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainExecutionRoutes" not in text:

    text=text.replace(
    'const brainDecisionRoutes = require("./routes/brainDecisionRoutes");',
    '''const brainDecisionRoutes = require("./routes/brainDecisionRoutes");

const brainExecutionRoutes = require("./routes/brainExecutionRoutes");'''
    )


if 'app.use("/brain", brainExecutionRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainDecisionRoutes);',
    '''app.use("/brain", brainDecisionRoutes);

app.use("/brain", brainExecutionRoutes);'''
    )


p.write_text(text)

PY




echo "=== Testing Layer 19 modules ==="


node - <<'NODE'

require("./services/assets/src/execution/actionPermissionEngine");

require("./services/assets/src/execution/actionPlannerEngine");

require("./services/assets/src/execution/actionExecutionEngine");


console.log(
"Layer 19 action execution loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 19 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test execution pipeline"
echo "3. commit + tag"

