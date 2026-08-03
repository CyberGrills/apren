#!/bin/bash
set -e

echo "=== āprən Food Brain Economic Real-Time Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/food-brain-economic-v1

cp -r services/assets/src \
backups/food-brain-economic-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating economic modules ==="

mkdir -p services/assets/src/economy



cat > services/assets/src/economy/valuationEngine.js <<'JS'
const { pool } = require("../postgres");


function calculateValue(asset){

const base =
Number(asset.current_value || 0);


const freshness =
Number(asset.freshness_score || 0);


const demand =
Number(asset.demand_score || 0);


const trust =
Number(asset.trust_score || 0);



const freshnessMultiplier =
0.5 + (freshness / 200);


const demandMultiplier =
0.5 + (demand / 200);


const trustMultiplier =
0.7 + (trust / 300);



const value =
Number(
(
base *
freshnessMultiplier *
demandMultiplier *
trustMultiplier
).toFixed(2)
);



return {

base_value:base,

freshness_score:freshness,

demand_score:demand,

trust_score:trust,

economic_value:value

};

}



async function evaluate(assetId){


const result =
await pool.query(
`
SELECT *
FROM food_assets
WHERE id=$1
`,
[assetId]
);



if(!result.rows[0]){

throw new Error("Asset not found");

}



const valuation =
calculateValue(
result.rows[0]
);



const saved =
await pool.query(
`
INSERT INTO food_brain_economic_values
(
asset_id,
base_value,
economic_value,
freshness_score,
demand_score,
trust_score
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
valuation.base_value,
valuation.economic_value,
valuation.freshness_score,
valuation.demand_score,
valuation.trust_score
]
);



return {

asset_id:assetId,

valuation,

record:saved.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_economic_values
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);


return result.rows;

}



module.exports={
evaluate,
history
};
JS




cat > services/assets/src/economy/marketPulseEngine.js <<'JS'
function analyze(data){


const freshness =
Number(data.freshness || 0);


const demand =
Number(data.demand || 0);



let signal="STABLE";


if(freshness<=0){

signal="EXPIRED";

}

else if(
freshness<30 &&
demand>70
){

signal="URGENT";

}

else if(
demand>80 &&
freshness>70
){

signal="RISING";

}

else if(
demand<30
){

signal="DECLINING";

}



return {

signal,

freshness,

demand

};

}



module.exports={
analyze
};
JS




cat > services/assets/src/economy/economicEventEngine.js <<'JS'
const {pool}=require("../postgres");


async function record(data){


const result =
await pool.query(
`
INSERT INTO food_brain_economic_events
(
asset_id,
event_type,
value,
details
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.asset_id,
data.event_type,
data.value || null,
JSON.stringify(data.details || {})
]
);


return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_economic_events
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);


return result.rows;

}



module.exports={
record,
history
};
JS





echo "=== Creating economic tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_economic_values
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

base_value NUMERIC(10,2),

economic_value NUMERIC(10,2),

freshness_score NUMERIC(5,2),

demand_score NUMERIC(5,2),

trust_score NUMERIC(5,2),

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_economic_values_asset
ON food_brain_economic_values(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_economic_events
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

event_type TEXT,

value NUMERIC(10,2),

details JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_economic_events_asset
ON food_brain_economic_events(asset_id);


SQL





echo "=== Adding economic routes ==="


python3 <<'PY'

from pathlib import Path

path=Path(
"services/assets/src/server.js"
)

text=path.read_text()


if "valuationEngine" not in text:

    text=text.replace(
    'const executiveGovernor',
    '''const valuationEngine = require("./economy/valuationEngine");
const marketPulseEngine = require("./economy/marketPulseEngine");
const economicEventEngine = require("./economy/economicEventEngine");

const executiveGovernor'''
    )



routes="""


app.post("/economy/value/:assetId", async(req,res)=>{

try{

res.json(
await valuationEngine.evaluate(
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



app.get("/economy/value/history/:assetId", async(req,res)=>{

try{

res.json(
await valuationEngine.history(
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



app.post("/economy/pulse", async(req,res)=>{

try{

res.json(
marketPulseEngine.analyze(
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



app.post("/economy/event", async(req,res)=>{

try{

res.json(
await economicEventEngine.record(
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



app.get("/economy/events/:assetId", async(req,res)=>{

try{

res.json(
await economicEventEngine.history(
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


"""


if "/economy/value/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]



path.write_text(text)

PY





echo "=== Testing economic modules ==="


node - <<'NODE'

require("./services/assets/src/economy/valuationEngine");

require("./services/assets/src/economy/marketPulseEngine");

require("./services/assets/src/economy/economicEventEngine");

console.log(
"Food brain economic modules loaded"
);

NODE



node --check services/assets/src/server.js


echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. restart assets service"
echo "2. test valuation"
echo "3. test market pulse"

