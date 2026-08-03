#!/bin/bash
set -e

echo "=== āprən Food Brain Unified Memory Core Layer 41 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer41-memory-core

cp -r services/assets/src \
backups/layer41-memory-core/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating memory database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_memory
(
id SERIAL PRIMARY KEY,

asset_id INTEGER,

memory_type TEXT,

event JSONB,

decision JSONB,

outcome JSONB,

confidence NUMERIC DEFAULT 0,

importance NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_brain_memory_asset
ON food_brain_memory(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_experience_patterns
(
id SERIAL PRIMARY KEY,

pattern JSONB,

successful_action TEXT,

success_rate NUMERIC DEFAULT 0,

usage_count INTEGER DEFAULT 0,

confidence NUMERIC DEFAULT 0,

updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_experience_pattern
ON food_brain_experience_patterns(successful_action);



SQL



echo "=== Creating memory engines ==="


mkdir -p services/assets/src/memory



cat > services/assets/src/memory/memoryStoreEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(assetId,data){

await pool.query(
`
INSERT INTO food_brain_memory
(
asset_id,
memory_type,
event,
decision,
outcome,
confidence,
importance
)

VALUES($1,$2,$3,$4,$5,$6,$7)
`,
[
assetId,
data.type || "EVENT",
JSON.stringify(data.event || {}),
JSON.stringify(data.decision || {}),
JSON.stringify(data.outcome || {}),
data.confidence || 0,
data.importance || 0
]
);


return {
stored:true
};

}


module.exports={
remember
};

JS



cat > services/assets/src/memory/memoryRetrievalEngine.js <<'JS'

const {pool}=require("../postgres");


async function retrieve(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory
WHERE asset_id=$1
ORDER BY importance DESC
LIMIT 20
`,
[assetId]
);


return result.rows;

}


module.exports={
retrieve
};

JS



cat > services/assets/src/memory/patternRecognitionEngine.js <<'JS'

function analyze(memories){


let success=0;


for(const memory of memories){

if(memory.outcome){

success++;

}

}


return {

patterns_found:memories.length,

experience_score:
memories.length
?
Math.round(
(success/memories.length)*100
)
:0

};

}


module.exports={
analyze
};

JS



cat > services/assets/src/memory/brainExperienceEngine.js <<'JS'

const memory =
require("./memoryRetrievalEngine");

const pattern =
require("./patternRecognitionEngine");


async function learn(assetId){


const memories =
await memory.retrieve(assetId);


const analysis =
pattern.analyze(memories);


return {

asset_id:assetId,

experience:analysis

};

}


module.exports={
learn
};

JS



echo "=== Creating memory route ==="


cat > services/assets/src/routes/brainMemoryRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const store =
require("../memory/memoryStoreEngine");

const experience =
require("../memory/brainExperienceEngine");



router.post(
"/memory/store/:assetId",
async(req,res)=>{

res.json(
await store.remember(
req.params.assetId,
req.body
)
);

});



router.get(
"/memory/learn/:assetId",
async(req,res)=>{

res.json(
await experience.learn(
req.params.assetId
)
);

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



echo "=== Testing Layer 41 modules ==="


node - <<'NODE'

require("./services/assets/src/memory/memoryStoreEngine");

require("./services/assets/src/memory/memoryRetrievalEngine");

require("./services/assets/src/memory/patternRecognitionEngine");

require("./services/assets/src/memory/brainExperienceEngine");


console.log(
"Layer 41 unified memory core loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 41 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test brain memory"
echo "3. commit + tag"

