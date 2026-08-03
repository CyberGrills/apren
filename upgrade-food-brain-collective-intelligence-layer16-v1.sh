#!/bin/bash
set -e

echo "=== āprən Food Brain Collective Intelligence Layer 16 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer16-collective-intelligence

cp -r services/assets/src \
backups/layer16-collective-intelligence/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating collective intelligence database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_market_patterns
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

region TEXT,

pattern_type TEXT,

signal TEXT,

impact_score NUMERIC DEFAULT 0,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_market_patterns_asset
ON food_brain_market_patterns(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_demand_signals
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

region TEXT,

demand_level TEXT,

demand_score NUMERIC,

trend TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_demand_asset
ON food_brain_demand_signals(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_ecosystem_events
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

event_type TEXT,

source TEXT,

event_data JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_ecosystem_asset
ON food_brain_ecosystem_events(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_collective_memory
(
id SERIAL PRIMARY KEY,

memory_type TEXT,

memory_key TEXT UNIQUE,

memory_value JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_collective_memory_key
ON food_brain_collective_memory(memory_key);



SQL



echo "=== Creating collective intelligence modules ==="


mkdir -p services/assets/src/collective



cat > services/assets/src/collective/marketPatternEngine.js <<'JS'

const {pool}=require("../postgres");


async function record(pattern){

const result =
await pool.query(
`
INSERT INTO food_brain_market_patterns
(
asset_id,
region,
pattern_type,
signal,
impact_score,
confidence
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
pattern.assetId,
pattern.region,
pattern.type,
pattern.signal,
pattern.impact || 0,
pattern.confidence || 0
]
);


return result.rows[0];

}


async function history(assetId){

const result =
await pool.query(
`
SELECT *

FROM food_brain_market_patterns

WHERE asset_id=$1

ORDER BY created_at DESC
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



cat > services/assets/src/collective/demandIntelligenceEngine.js <<'JS'

function analyze(signals){

let score=50;


for(const signal of signals){

if(signal==="HIGH_DEMAND"){

score+=20;

}


if(signal==="LOW_SUPPLY"){

score+=15;

}

}



if(score>100){

score=100;

}


let level="NORMAL";


if(score>=75){

level="HIGH";

}

else if(score<=35){

level="LOW";

}



return {

demand_score:score,

demand_level:level

};

}


module.exports={
analyze
};

JS



cat > services/assets/src/collective/ecosystemMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(event){

const result =
await pool.query(
`
INSERT INTO food_brain_ecosystem_events
(
asset_id,
event_type,
source,
event_data
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
event.assetId,
event.type,
event.source,
JSON.stringify(event.data || {})
]
);


return result.rows[0];

}


module.exports={
remember
};

JS



cat > services/assets/src/collective/collectiveMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(type,key,value,confidence){

const result =
await pool.query(
`
INSERT INTO food_brain_collective_memory
(
memory_type,
memory_key,
memory_value,
confidence
)

VALUES
($1,$2,$3,$4)

ON CONFLICT(memory_key)

DO UPDATE SET

memory_value=$3,

confidence=$4

RETURNING *
`,
[
type,
key,
JSON.stringify(value),
confidence || 0
]
);


return result.rows[0];

}


async function recall(key){

const result =
await pool.query(
`
SELECT *

FROM food_brain_collective_memory

WHERE memory_key=$1
`,
[key]
);


return result.rows[0] || null;

}


module.exports={
remember,
recall
};

JS



cat > services/assets/src/collective/collectiveIntelligenceEngine.js <<'JS'

const demand =
require("./demandIntelligenceEngine");

const memory =
require("./collectiveMemoryEngine");

const {pool}=require("../postgres");



async function analyze(assetId,data){


const demandResult =
demand.analyze(
data.signals || []
);



const collective =
await memory.remember(

"DEMAND_PATTERN",

`${data.region}:${assetId}`,

{
assetId,
region:data.region,
demand:demandResult
},

85

);



return {

asset_id:assetId,

region:data.region,

demand:demandResult,

memory:collective

};

}


module.exports={
analyze
};

JS



echo "=== Creating routes ==="


cat > services/assets/src/routes/brainCollectiveRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const intelligence =
require("../collective/collectiveIntelligenceEngine");



router.post("/collective/analyze/:assetId",async(req,res)=>{

try{

res.json(
await intelligence.analyze(
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



echo "=== Register routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainCollectiveRoutes" not in text:

    text=text.replace(
    'const brainPredictionRoutes = require("./routes/brainPredictionRoutes");',
    '''const brainPredictionRoutes = require("./routes/brainPredictionRoutes");

const brainCollectiveRoutes = require("./routes/brainCollectiveRoutes");'''
    )



if 'app.use("/brain", brainCollectiveRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainPredictionRoutes);',
    '''app.use("/brain", brainPredictionRoutes);

app.use("/brain", brainCollectiveRoutes);'''
    )


p.write_text(text)

PY



echo "=== Testing Layer 16 modules ==="


node - <<'NODE'

require("./services/assets/src/collective/marketPatternEngine");

require("./services/assets/src/collective/demandIntelligenceEngine");

require("./services/assets/src/collective/collectiveIntelligenceEngine");


console.log(
"Layer 16 collective intelligence loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 16 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test collective intelligence"
echo "3. commit + tag"


