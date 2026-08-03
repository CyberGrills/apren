#!/bin/bash
set -e

echo "=== āprən Food Brain Memory Fusion Intelligence Layer 31 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer31-memory-fusion

cp -r services/assets/src \
backups/layer31-memory-fusion/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating memory fusion database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_memory_fusion
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

memory_type TEXT,

memory_source TEXT,

memory_data JSONB,

importance NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_memory_fusion_asset
ON food_brain_memory_fusion(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_memory_patterns
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

pattern TEXT,

pattern_data JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_memory_patterns_asset
ON food_brain_memory_patterns(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_future_predictions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

prediction TEXT,

reasoning JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_future_prediction_asset
ON food_brain_future_predictions(asset_id);



SQL



echo "=== Creating memory engines ==="


mkdir -p services/assets/src/memory



cat > services/assets/src/memory/memoryCollectorEngine.js <<'JS'

const {pool}=require("../postgres");


async function collect(assetId,data){

const memories=[

{
type:"MARKET",
source:"marketbrain",
data:data.market
},

{
type:"NEGOTIATION",
source:"agentbrain",
data:data.negotiation
},

{
type:"ACTION",
source:"autonomy",
data:data.action
},

{
type:"EXECUTION",
source:"execution",
data:data.execution
}

];


for(const memory of memories){

await pool.query(
`
INSERT INTO food_brain_memory_fusion
(
asset_id,
memory_type,
memory_source,
memory_data,
importance
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
memory.type,
memory.source,
JSON.stringify(memory.data),
80
]
);

}


return memories;

}


module.exports={
collect
};

JS



cat > services/assets/src/memory/patternRecognitionEngine.js <<'JS'


function analyze(memories){


let confidence=50;

let pattern="NORMAL_ACTIVITY";


const text =
JSON.stringify(memories);



if(text.includes("DISTRIBUTE_FAST")){

pattern="FAST_DISTRIBUTION_PATTERN";

confidence+=30;

}



if(text.includes("HIGH")){

pattern="HIGH_DEMAND_PATTERN";

confidence+=20;

}



if(confidence>100)
confidence=100;


return {

pattern,

confidence

};

}



module.exports={
analyze
};

JS



cat > services/assets/src/memory/futurePredictionEngine.js <<'JS'


function predict(pattern){


let prediction="STABLE";


if(pattern.pattern==="FAST_DISTRIBUTION_PATTERN"){

prediction="EARLY_MOVEMENT_REQUIRED";

}


return {

prediction,

confidence:pattern.confidence

};


}



module.exports={
predict
};

JS



cat > services/assets/src/memory/memoryFusionBrainEngine.js <<'JS'


const collector =
require("./memoryCollectorEngine");

const pattern =
require("./patternRecognitionEngine");

const prediction =
require("./futurePredictionEngine");

const {pool}=require("../postgres");



async function fuse(assetId,data){


const memories =
await collector.collect(
assetId,
data
);



const learned =
pattern.analyze(
memories
);



const future =
prediction.predict(
learned
);



await pool.query(
`
INSERT INTO food_brain_memory_patterns
(
asset_id,
pattern,
pattern_data,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
learned.pattern,
JSON.stringify(memories),
learned.confidence
]
);



await pool.query(
`
INSERT INTO food_brain_future_predictions
(
asset_id,
prediction,
reasoning,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
future.prediction,
JSON.stringify(learned),
future.confidence
]
);



return {

asset_id:assetId,

memory_count:memories.length,

pattern:learned,

future_prediction:future

};


}



module.exports={
fuse
};

JS



echo "=== Creating memory route ==="


cat > services/assets/src/routes/brainMemoryRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const brain =
require("../memory/memoryFusionBrainEngine");


router.post(
"/memory/fuse/:assetId",
async(req,res)=>{

try{

res.json(
await brain.fuse(
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



echo "=== Register memory route ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainMemoryRoutes" not in text:

 text=text.replace(
 'const brainOrchestratorRoutes = require("./routes/brainOrchestratorRoutes");',
 '''const brainOrchestratorRoutes = require("./routes/brainOrchestratorRoutes");

const brainMemoryRoutes = require("./routes/brainMemoryRoutes");'''
 )


if 'app.use("/brain", brainMemoryRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainOrchestratorRoutes);',
 '''app.use("/brain", brainOrchestratorRoutes);

app.use("/brain", brainMemoryRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 31 modules ==="


node - <<'NODE'

require("./services/assets/src/memory/memoryCollectorEngine");

require("./services/assets/src/memory/patternRecognitionEngine");

require("./services/assets/src/memory/futurePredictionEngine");

require("./services/assets/src/memory/memoryFusionBrainEngine");


console.log(
"Layer 31 memory fusion intelligence loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 31 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test memory fusion"
echo "3. commit + tag"


