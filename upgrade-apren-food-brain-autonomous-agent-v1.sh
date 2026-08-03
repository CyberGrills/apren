#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Agent v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/food-brain-agent-v1

cp -r services/assets/src \
backups/food-brain-agent-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating brain modules ==="

mkdir -p services/assets/src/brain



cat > services/assets/src/brain/recommendationEngine.js <<'JS'
function generateRecommendation(data){

const freshness =
Number(data.freshness || 0);

const demand =
Number(data.demand || 0);

const trust =
Number(data.trust || 0);


let action="MONITOR";

let reason="Asset conditions stable";


if(freshness <= 0){

action="BLOCK_TRADE";

reason="Food expired and cannot continue trading";

}

else if(freshness < 30 && demand > 70){

action="FAST_MOVE";

reason="High demand but freshness is declining";

}

else if(freshness < 40){

action="DISCOUNT";

reason="Freshness decline requires faster movement";

}

else if(demand > 80 && freshness > 80){

action="PROMOTE";

reason="High demand and strong freshness";

}

else if(trust < 30){

action="REVIEW_TRUST";

reason="Asset trust requires verification";

}



return {

action,

reason,

confidence:
Math.min(
99,
Math.round(
(
freshness +
demand +
trust
) / 3
)
)

};

}


module.exports={
generateRecommendation
};
JS





cat > services/assets/src/brain/foodBrainEngine.js <<'JS'
const { pool } = require("../postgres");

const recommendation =
require("./recommendationEngine");


const rules =
require("../rules/ruleEngine");


async function analyze(assetId){


const asset =
await pool.query(
`
SELECT *
FROM food_assets
WHERE id=$1
`,
[
assetId
]
);



if(!asset.rows[0]){

throw new Error("Asset not found");

}


const item =
asset.rows[0];


const context={

freshness:item.freshness_score,

trust:item.trust_score,

demand:item.demand_score,

supply:item.available_supply

};



const ruleResult =
await rules.evaluate(context);



const recommendationResult =
recommendation.generateRecommendation(context);



const finalAction =
ruleResult.allowed
?
recommendationResult.action
:
"BLOCK_TRADE";



const result =
await pool.query(
`
INSERT INTO food_brain_actions
(
asset_id,
action,
reason,
confidence,
allowed
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
assetId,
finalAction,
recommendationResult.reason,
recommendationResult.confidence,
ruleResult.allowed
]
);



return {

asset_id:assetId,

brain_action:finalAction,

recommendation:recommendationResult,

rules:ruleResult,

record:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_actions
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
analyze,
history
};
JS





echo "=== Creating brain database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_actions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

reason TEXT,

confidence NUMERIC(5,2),

allowed BOOLEAN,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_brain_asset
ON food_brain_actions(asset_id);



SQL





echo "=== Adding brain routes ==="


python3 <<'PY'

from pathlib import Path

path=Path(
"services/assets/src/server.js"
)

text=path.read_text()


if "foodBrainEngine" not in text:

    text=text.replace(
    'const decisionEngine',
    'const foodBrainEngine = require("./brain/foodBrainEngine");\n\nconst decisionEngine'
    )



routes="""


app.post("/brain/analyze/:assetId", async(req,res)=>{

try{

const result =
await foodBrainEngine.analyze(
req.params.assetId
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/history/:assetId", async(req,res)=>{

try{

const result =
await foodBrainEngine.history(
req.params.assetId
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


"""


if "/brain/analyze/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY





echo "=== Testing brain modules ==="


node - <<'NODE'

require("./services/assets/src/brain/recommendationEngine");

require("./services/assets/src/brain/foodBrainEngine");

console.log(
"Food brain autonomous agent loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test brain analysis"

