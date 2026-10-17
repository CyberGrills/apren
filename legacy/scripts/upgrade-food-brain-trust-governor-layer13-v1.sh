#!/bin/bash
set -e

echo "=== āprən Food Brain Trust Governor Layer 13 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer13-trust-governor

cp -r services/assets/src \
backups/layer13-trust-governor/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating governance modules ==="

mkdir -p services/assets/src/governance



cat > services/assets/src/governance/riskEvaluationEngine.js <<'JS'
function evaluate(action, confidence){

let risk="HIGH";


if(confidence >=90){
risk="LOW";
}
else if(confidence >=70){
risk="MEDIUM";
}


return {

action,

confidence,

risk

};

}


module.exports={
evaluate
};
JS




cat > services/assets/src/governance/permissionMemoryEngine.js <<'JS'
const permissions={};


function setPermission(userId,mode){

permissions[userId]=mode;

return permissions[userId];

}



function getPermission(userId){

return permissions[userId] || "ASSISTED";

}


module.exports={
setPermission,
getPermission
};
JS




cat > services/assets/src/governance/approvalPolicyEngine.js <<'JS'
function approve(risk,permission){


if(risk==="LOW" && permission==="AUTONOMOUS"){

return {
approved:true,
mode:"AUTONOMOUS"
};

}


if(risk==="MEDIUM"){

return {
approved:false,
mode:"ASSISTED",
requires_confirmation:true
};

}



return {

approved:false,

mode:"PROTECTED"

};

}



module.exports={
approve
};
JS




cat > services/assets/src/governance/trustAssessmentEngine.js <<'JS'
function assess(result){


let score=50;


if(result.execution_status==="SUCCESS"){

score+=40;

}


if(result.risk==="LOW"){

score+=10;

}


return {

trust_score:Math.min(score,100)

};

}


module.exports={
assess
};
JS




cat > services/assets/src/governance/actionReversalEngine.js <<'JS'
async function reverse(action){


return {

status:"READY",

original_action:action,

message:"Reversal pathway prepared"

};

}


module.exports={
reverse
};
JS





cat > services/assets/src/governance/trustGovernorEngine.js <<'JS'
const risk =
require("./riskEvaluationEngine");

const permission =
require("./permissionMemoryEngine");

const policy =
require("./approvalPolicyEngine");

const trust =
require("./trustAssessmentEngine");

const {pool}=require("../postgres");



async function evaluate(assetId,data){


const riskResult =
risk.evaluate(
data.action,
data.confidence || 0
);



const userPermission =
permission.getPermission(
data.userId || "default"
);



const approval =
policy.approve(
riskResult.risk,
userPermission
);



const trustScore =
trust.assess({
execution_status:"PENDING",
risk:riskResult.risk
});



const record =
await pool.query(
`
INSERT INTO food_brain_trust_events
(
asset_id,
action,
risk_level,
confidence,
approval_mode,
governor_decision
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
data.action,
riskResult.risk,
data.confidence || 0,
approval.mode,
approval.approved
]
);



return {

asset_id:assetId,

risk:riskResult,

permission:userPermission,

approval,

trust:trustScore,

record:record.rows[0]

};

}



module.exports={
evaluate
};
JS




echo "=== Creating database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_trust_events
(

id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

risk_level TEXT,

confidence NUMERIC,

approval_mode TEXT,

governor_decision BOOLEAN,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


CREATE INDEX IF NOT EXISTS idx_trust_asset
ON food_brain_trust_events(asset_id);


SQL




echo "=== Creating routes ==="


cat > services/assets/src/routes/brainGovernanceRoutes.js <<'JS'
const express=require("express");

const router=express.Router();

const governor =
require("../governance/trustGovernorEngine");



router.post("/governance/evaluate/:assetId",async(req,res)=>{

try{

res.json(
await governor.evaluate(
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


router.get("/governance/history/:assetId",async(req,res)=>{

res.json({

asset_id:req.params.assetId,

message:"Trust history ready"

});

});


module.exports=router;
JS




echo "=== Register routes ==="


python3 <<'PY'
from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainGovernanceRoutes" not in text:

    text=text.replace(
    'const brainExecutionRoutes = require("./routes/brainExecutionRoutes");',
    '''const brainExecutionRoutes = require("./routes/brainExecutionRoutes");

const brainGovernanceRoutes = require("./routes/brainGovernanceRoutes");'''
    )



if 'app.use("/brain", brainGovernanceRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainExecutionRoutes);',
    '''app.use("/brain", brainExecutionRoutes);

app.use("/brain", brainGovernanceRoutes);'''
    )


p.write_text(text)

PY





echo "=== Testing modules ==="


node - <<'NODE'

require("./services/assets/src/governance/riskEvaluationEngine");

require("./services/assets/src/governance/approvalPolicyEngine");

require("./services/assets/src/governance/trustGovernorEngine");

console.log(
"Layer 13 trust governor loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 13 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test governance"
echo "3. commit + tag"


