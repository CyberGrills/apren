#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Action Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/food-brain-autonomy-v1

cp -r services/assets/src \
backups/food-brain-autonomy-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating autonomy modules ==="

mkdir -p services/assets/src/autonomy



cat > services/assets/src/autonomy/actionEngine.js <<'JS'
const { pool } = require("../postgres");


function generateAction(data){

let action="MONITOR";

let reason="Conditions stable";


const freshness =
Number(data.freshness || 0);

const demand =
Number(data.demand || 0);

const trust =
Number(data.trust || 0);



if(freshness <= 0){

action="BLOCK_TRADE";

reason="Food expired. Trading prevented.";

}

else if(
freshness < 30 &&
demand > 70
){

action="FAST_MOVE";

reason="High demand detected while freshness declines.";

}

else if(
freshness < 40
){

action="DISCOUNT";

reason="Freshness declining. Accelerate movement.";

}

else if(
freshness > 80 &&
demand > 80
){

action="BOOST_DISCOVERY";

reason="Strong freshness and market demand.";

}

else if(
trust < 30
){

action="REQUIRE_REVIEW";

reason="Trust score requires verification.";

}



return {

action,

reason

};

}



async function createAction(assetId,data){


const decision =
generateAction(data);



const result =
await pool.query(
`
INSERT INTO food_brain_actions_queue
(
asset_id,
action,
reason,
status
)

VALUES
($1,$2,$3,'PENDING')

RETURNING *
`,
[
assetId,
decision.action,
decision.reason
]
);



return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_actions_queue
WHERE asset_id=$1
ORDER BY id DESC
`,
[
assetId
]
);


return result.rows;

}



module.exports={
generateAction,
createAction,
history
};
JS





cat > services/assets/src/autonomy/executionGuard.js <<'JS'
function validate(action){

const blocked=[
"DELETE",
"REMOVE_USER"
];


if(
blocked.includes(action)
){

return {

allowed:false,

reason:"Unsafe action blocked"

};

}



return {

allowed:true,

reason:"Action approved"

};

}



module.exports={
validate
};
JS





cat > services/assets/src/autonomy/automationEngine.js <<'JS'
const { pool } = require("../postgres");

const guard =
require("./executionGuard");



async function execute(actionId){


const action =
await pool.query(
`
SELECT *
FROM food_brain_actions_queue
WHERE id=$1
`,
[
actionId
]
);



if(!action.rows[0]){

throw new Error("Action not found");

}



const item =
action.rows[0];



const permission =
guard.validate(
item.action
);



let status =
permission.allowed
?
"EXECUTED"
:
"BLOCKED";



await pool.query(
`
UPDATE food_brain_actions_queue
SET status=$1
WHERE id=$2
`,
[
status,
actionId
]
);



const log =
await pool.query(
`
INSERT INTO food_brain_execution_log
(
action_id,
asset_id,
result,
impact
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
actionId,
item.asset_id,
status,
permission.reason
]
);



return log.rows[0];

}



module.exports={
execute
};
JS





echo "=== Creating autonomy tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_actions_queue
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

reason TEXT,

status TEXT DEFAULT 'PENDING',

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_brain_actions_asset
ON food_brain_actions_queue(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_execution_log
(
id SERIAL PRIMARY KEY,

action_id INTEGER REFERENCES food_brain_actions_queue(id)
ON DELETE CASCADE,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

result TEXT,

impact TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_brain_execution_asset
ON food_brain_execution_log(asset_id);



SQL





echo "=== Adding autonomy routes ==="


python3 <<'PY'

from pathlib import Path

path=Path(
"services/assets/src/server.js"
)

text=path.read_text()



if "actionEngine" not in text:

    text=text.replace(
    'const feedbackEngine',
    'const actionEngine = require("./autonomy/actionEngine");\nconst automationEngine = require("./autonomy/automationEngine");\n\nconst feedbackEngine'
    )



routes="""


app.post("/brain/action/create/:assetId", async(req,res)=>{

try{

res.json(
await actionEngine.createAction(
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



app.get("/brain/actions/:assetId", async(req,res)=>{

try{

res.json(
await actionEngine.history(
req.params.assetId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.post("/brain/action/execute/:actionId", async(req,res)=>{

try{

res.json(
await automationEngine.execute(
req.params.actionId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


"""


if "/brain/action/create/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY





echo "=== Testing autonomy modules ==="


node - <<'NODE'

require("./services/assets/src/autonomy/actionEngine");

require("./services/assets/src/autonomy/executionGuard");

require("./services/assets/src/autonomy/automationEngine");

console.log(
"Food brain autonomous action modules loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. create action"
echo "4. execute action"

