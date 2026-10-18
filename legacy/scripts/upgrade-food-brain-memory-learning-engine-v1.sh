#!/bin/bash
set -e

echo "=== āprən Food Brain Memory Learning Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/food-brain-memory-v1

cp -r services/assets/src \
backups/food-brain-memory-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating memory modules ==="

mkdir -p services/assets/src/memory



cat > services/assets/src/memory/brainMemoryEngine.js <<'JS'
const { pool } = require("../postgres");


async function storeMemory(data){

const result =
await pool.query(
`
INSERT INTO food_brain_memory
(
asset_id,
event_type,
input_data,
decision,
outcome,
accuracy_score
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.asset_id,
data.event_type,
JSON.stringify(data.input_data || {}),
data.decision,
data.outcome || null,
data.accuracy_score || null
]
);


return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory
WHERE asset_id=$1
ORDER BY id DESC
`,
[
assetId
]
);


return result.rows;

}



async function learn(assetId){

const memories =
await history(assetId);



let successful=0;
let total=memories.length;


for(const item of memories){

if(
item.accuracy_score &&
Number(item.accuracy_score)>=80
){

successful++;

}

}



const learningScore =
total === 0
?
0
:
Math.round(
(successful / total) * 100
);



return {

asset_id:assetId,

memory_events:total,

learning_score:learningScore,

confidence:
Math.min(
99,
50 + learningScore / 2
)

};


}



module.exports={
storeMemory,
history,
learn
};
JS




cat > services/assets/src/memory/predictionEngine.js <<'JS'
const { pool } = require("../postgres");


async function predict(assetId){


const memories =
await pool.query(
`
SELECT *
FROM food_brain_memory
WHERE asset_id=$1
ORDER BY id DESC
LIMIT 20
`,
[
assetId
]
);



let risk="LOW";

let confidence=50;



if(memories.rows.length > 5){

confidence=70;

}



const expiring =
memories.rows.filter(
m =>
String(m.event_type)
.includes("EXPIR")
);



if(expiring.length>2){

risk="HIGH";

confidence=85;

}



const prediction =
risk==="HIGH"
?
"Move asset before freshness loss"
:
"Asset conditions stable";



const result =
await pool.query(
`
INSERT INTO food_predictions
(
asset_id,
prediction,
expected_result,
confidence
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
prediction,
risk,
confidence
]
);



return {

prediction,

risk,

confidence,

record:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_predictions
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
predict,
history
};
JS




echo "=== Creating brain memory tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_memory
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

event_type TEXT,

input_data JSONB,

decision TEXT,

outcome TEXT,

accuracy_score NUMERIC(5,2),

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_brain_memory_asset
ON food_brain_memory(asset_id);



CREATE TABLE IF NOT EXISTS food_predictions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

prediction TEXT,

expected_result TEXT,

confidence NUMERIC(5,2),

resolved BOOLEAN DEFAULT false,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_predictions_asset
ON food_predictions(asset_id);



SQL





echo "=== Adding memory routes ==="


python3 <<'PY'

from pathlib import Path

path=Path(
"services/assets/src/server.js"
)

text=path.read_text()



if "brainMemoryEngine" not in text:

    text=text.replace(
    'const foodBrainOrchestrator',
    'const brainMemoryEngine = require("./memory/brainMemoryEngine");\nconst predictionEngine = require("./memory/predictionEngine");\n\nconst foodBrainOrchestrator'
    )



routes="""

app.post("/brain/memory/store", async(req,res)=>{

try{

const result =
await brainMemoryEngine.storeMemory(
req.body
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/memory/:assetId", async(req,res)=>{

try{

res.json(
await brainMemoryEngine.history(
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



app.get("/brain/learn/:assetId", async(req,res)=>{

try{

res.json(
await brainMemoryEngine.learn(
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



app.post("/brain/predict/:assetId", async(req,res)=>{

try{

res.json(
await predictionEngine.predict(
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



app.get("/brain/predictions/:assetId", async(req,res)=>{

try{

res.json(
await predictionEngine.history(
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



if "/brain/memory/store" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]



path.write_text(text)

PY




echo "=== Testing memory modules ==="


node - <<'NODE'

require("./services/assets/src/memory/brainMemoryEngine");

require("./services/assets/src/memory/predictionEngine");

console.log(
"Food brain memory modules loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test memory"
echo "4. test prediction"

