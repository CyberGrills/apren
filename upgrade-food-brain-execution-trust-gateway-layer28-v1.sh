#!/bin/bash
set -e

echo "=== āprən Food Brain Execution Trust Gateway Layer 28 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer28-execution-trust

cp -r services/assets/src \
backups/layer28-execution-trust/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating execution gateway database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_execution_queue
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

execution_status TEXT DEFAULT 'PENDING',

priority NUMERIC DEFAULT 0,

payload JSONB,

approved BOOLEAN DEFAULT FALSE,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



ALTER TABLE food_brain_execution_queue

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS action TEXT,

ADD COLUMN IF NOT EXISTS execution_status TEXT DEFAULT 'PENDING',

ADD COLUMN IF NOT EXISTS priority NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS payload JSONB,

ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;



CREATE INDEX IF NOT EXISTS idx_execution_queue_asset
ON food_brain_execution_queue(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_execution_permissions
(
id SERIAL PRIMARY KEY,

action TEXT,

minimum_confidence NUMERIC DEFAULT 90,

auto_execute BOOLEAN DEFAULT FALSE,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



ALTER TABLE food_brain_execution_permissions

ADD COLUMN IF NOT EXISTS action TEXT,

ADD COLUMN IF NOT EXISTS minimum_confidence NUMERIC DEFAULT 90,

ADD COLUMN IF NOT EXISTS auto_execute BOOLEAN DEFAULT FALSE;



CREATE TABLE IF NOT EXISTS food_brain_action_outcomes
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

result JSONB,

success_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



ALTER TABLE food_brain_action_outcomes

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS action TEXT,

ADD COLUMN IF NOT EXISTS result JSONB,

ADD COLUMN IF NOT EXISTS success_score NUMERIC DEFAULT 0;



CREATE INDEX IF NOT EXISTS idx_action_outcome_asset
ON food_brain_action_outcomes(asset_id);



SQL



echo "=== Creating execution engines ==="



mkdir -p services/assets/src/execution



cat > services/assets/src/execution/trustGateEngine.js <<'JS'


function evaluate(data){


let approved=false;


if(
data.approved === true &&
data.confidence >= 90
){

approved=true;

}


return {

approved,

risk:
approved
?
"LOW"
:
"HIGH"

};

}



module.exports={
evaluate
};

JS





cat > services/assets/src/execution/executionRouterEngine.js <<'JS'


function route(action){


const routes={

TRADE:"TRADE_ENGINE",

DISTRIBUTE_FAST:"MARKET_ENGINE",

NOTIFY_BUYERS:"NOTIFICATION_ENGINE",

ADJUST_PRIORITY:"MARKET_ENGINE"

};


return routes[action] || "MANUAL_REVIEW";


}



module.exports={
route
};

JS





cat > services/assets/src/execution/outcomeFeedbackEngine.js <<'JS'


const {pool}=require("../postgres");


async function record(data){


const result =
await pool.query(
`
INSERT INTO food_brain_action_outcomes
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
record
};

JS





cat > services/assets/src/execution/executionGatewayEngine.js <<'JS'


const trust =
require("./trustGateEngine");

const router =
require("./executionRouterEngine");

const {pool}=require("../postgres");



async function execute(assetId,data){


const permission =
trust.evaluate(data);



if(!permission.approved){

return {

status:"WAITING_APPROVAL",

reason:"Trust gate blocked execution"

};

}



const destination =
router.route(data.action);



const result =
await pool.query(
`
INSERT INTO food_brain_execution_queue
(
asset_id,
action,
execution_status,
priority,
payload,
approved
)

VALUES($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
data.action,
"STARTED",
data.confidence,
JSON.stringify({
destination
}),
true
]
);



return {

status:"EXECUTION_STARTED",

destination,

execution:result.rows[0]

};


}



module.exports={
execute
};

JS





echo "=== Creating execution route ==="



cat > services/assets/src/routes/brainExecutionRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const execution =
require("../execution/executionGatewayEngine");



router.post(
"/execution/approve/:assetId",
async(req,res)=>{

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
 'const brainAutonomousRoutes = require("./routes/brainAutonomousRoutes");',
 '''const brainAutonomousRoutes = require("./routes/brainAutonomousRoutes");

const brainExecutionRoutes = require("./routes/brainExecutionRoutes");'''
 )


if 'app.use("/brain", brainExecutionRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainAutonomousRoutes);',
 '''app.use("/brain", brainAutonomousRoutes);

app.use("/brain", brainExecutionRoutes);'''
 )


p.write_text(text)

PY





echo "=== Testing Layer 28 modules ==="



node - <<'NODE'

require("./services/assets/src/execution/trustGateEngine");

require("./services/assets/src/execution/executionRouterEngine");

require("./services/assets/src/execution/outcomeFeedbackEngine");

require("./services/assets/src/execution/executionGatewayEngine");


console.log(
"Layer 28 execution trust gateway loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 28 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test execution gateway"
echo "3. commit + tag"


