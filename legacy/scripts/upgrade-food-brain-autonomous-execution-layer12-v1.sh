#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Execution Engine Layer 12 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer12-autonomous-execution

cp -r services/assets/src \
backups/layer12-autonomous-execution/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating execution modules ==="

mkdir -p services/assets/src/execution



cat > services/assets/src/execution/actionAuthorizationEngine.js <<'JS'
function authorize(action){

const allowed=[
"SELL_NOW",
"HOLD",
"PROMOTE",
"TRADE"
];


return {

authorized:
allowed.includes(action),

action,

reason:
allowed.includes(action)
?"Action approved by execution governor"
:"Action blocked"

};

}


module.exports={
authorize
};
JS





cat > services/assets/src/execution/executionPlanner.js <<'JS'
function plan(decision){


return {

action:decision.scenario,

steps:[

"Validate asset ownership",

"Check freshness status",

"Check market condition",

"Execute approved action",

"Store outcome"

]

};

}


module.exports={
plan
};
JS





cat > services/assets/src/execution/actionExecutor.js <<'JS'
async function execute(plan){


return {

status:"SIMULATED",

action:plan.action,

message:
"Execution pathway completed safely"

};

}


module.exports={
execute
};
JS





cat > services/assets/src/execution/outcomeMemoryEngine.js <<'JS'
const {pool}=require("../postgres");


async function remember(assetId,result){


const response =
await pool.query(
`
INSERT INTO food_brain_execution_history
(
asset_id,
action,
result
)

VALUES
($1,$2,$3)

RETURNING *
`,
[
assetId,
result.action,
JSON.stringify(result)
]
);


return response.rows[0];

}



module.exports={
remember
};

JS





cat > services/assets/src/execution/autonomousExecutionEngine.js <<'JS'
const authorization =
require("./actionAuthorizationEngine");

const planner =
require("./executionPlanner");

const executor =
require("./actionExecutor");

const memory =
require("./outcomeMemoryEngine");



async function execute(assetId,decision){


const approval =
authorization.authorize(
decision.scenario
);



if(!approval.authorized){

return {

status:"BLOCKED",

approval

};

}



const plan =
planner.plan(decision);



const result =
await executor.execute(plan);



const record =
await memory.remember(
assetId,
result
);



return {

asset_id:assetId,

approval,

plan,

execution:result,

record

};

}



module.exports={
execute
};

JS





echo "=== Creating database ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_execution_history
(

id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

result JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_execution_asset
ON food_brain_execution_history(asset_id);



SQL




echo "=== Adding execution route ==="


cat > services/assets/src/routes/brainExecutionRoutes.js <<'JS'
const express=require("express");

const router=express.Router();


const executionEngine =
require("../execution/autonomousExecutionEngine");



router.post("/execution/:assetId",async(req,res)=>{

try{


res.json(
await executionEngine.execute(
req.params.assetId,
req.body.decision
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




echo "=== Testing modules ==="


node - <<'NODE'

require("./services/assets/src/execution/actionAuthorizationEngine");

require("./services/assets/src/execution/executionPlanner");

require("./services/assets/src/execution/actionExecutor");

require("./services/assets/src/execution/autonomousExecutionEngine");


console.log(
"Layer 12 autonomous execution loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 12 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test execution"
echo "3. commit + tag"


