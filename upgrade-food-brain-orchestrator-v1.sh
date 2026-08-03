#!/bin/bash
set -e

echo "=== āprən Food Brain Orchestrator v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/food-brain-orchestrator-v1

cp -r services/assets/src \
backups/food-brain-orchestrator-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating orchestrator modules ==="

mkdir -p services/assets/src/orchestrator



cat > services/assets/src/orchestrator/marketSignalEngine.js <<'JS'
function generateMarketSignal(data){

let signal="NEUTRAL";

let adjustment=0;


if(
data.freshness >= 80 &&
data.demand >= 80 &&
data.trust >= 70
){

signal="POSITIVE";

adjustment=15;

}

else if(
data.freshness < 40 &&
data.demand > 70
){

signal="URGENT";

adjustment=-10;

}

else if(
data.freshness <= 0
){

signal="NEGATIVE";

adjustment=-100;

}


else if(
data.trust < 30
){

signal="REVIEW";

adjustment=-20;

}


return {

signal,

valuation_adjustment:adjustment

};


}


module.exports={
generateMarketSignal
};
JS





cat > services/assets/src/orchestrator/foodBrainOrchestrator.js <<'JS'
const { pool } = require("../postgres");


const brain =
require("../brain/foodBrainEngine");

const lifecycle =
require("../lifecycle/lifecycleEngine");

const decision =
require("../intelligence/decisionEngine");

const market =
require("./marketSignalEngine");



async function orchestrate(assetId){


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



const freshness =
Number(item.freshness_score || 0);



const life =
await lifecycle.updateLifecycle({

asset_id:assetId,

freshness,

market_value:item.current_value || 0,

reason:"Brain automatic lifecycle evaluation"

});



const intelligence =
await decision.evaluateAsset(
assetId
);



const brainResult =
await brain.analyze(
assetId
);



const signal =
market.generateMarketSignal({

freshness,

demand:Number(item.demand_score || 0),

trust:Number(item.trust_score || 0)

});




const result =
await pool.query(
`
INSERT INTO food_brain_cycles
(
asset_id,
lifecycle_state,
brain_action,
market_signal,
valuation_change,
executed
)

VALUES
($1,$2,$3,$4,$5,true)

RETURNING *
`,
[
assetId,
life.state,
brainResult.brain_action,
signal.signal,
signal.valuation_adjustment
]
);



return {

asset_id:assetId,

lifecycle:life.state,

brain_action:
brainResult.brain_action,

decision:
intelligence.decision,

market_signal:
signal.signal,

valuation_adjustment:
signal.valuation_adjustment,

executed:true,

cycle:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_cycles
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
orchestrate,
history
};
JS





echo "=== Creating brain cycle table ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_cycles
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

lifecycle_state TEXT,

brain_action TEXT,

market_signal TEXT,

valuation_change NUMERIC(10,2),

executed BOOLEAN DEFAULT false,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_brain_cycles_asset
ON food_brain_cycles(asset_id);



SQL





echo "=== Adding orchestrator routes ==="


python3 <<'PY'

from pathlib import Path

path=Path(
"services/assets/src/server.js"
)

text=path.read_text()



if "foodBrainOrchestrator" not in text:

    text=text.replace(
    'const foodBrainEngine',
    'const foodBrainOrchestrator = require("./orchestrator/foodBrainOrchestrator");\n\nconst foodBrainEngine'
    )



routes="""


app.post("/brain/orchestrate/:assetId", async(req,res)=>{

try{


const result =
await foodBrainOrchestrator.orchestrate(
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



app.get("/brain/cycles/:assetId", async(req,res)=>{

try{


const result =
await foodBrainOrchestrator.history(
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



if "/brain/orchestrate/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY




echo "=== Testing modules ==="


node - <<'NODE'

require("./services/assets/src/orchestrator/marketSignalEngine");

require("./services/assets/src/orchestrator/foodBrainOrchestrator");

console.log(
"Food brain orchestrator loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test orchestration"

