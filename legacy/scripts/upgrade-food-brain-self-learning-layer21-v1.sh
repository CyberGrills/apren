#!/bin/bash
set -e

echo "=== āprən Food Brain Self-Learning Evolution Layer 21 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer21-self-learning

cp -r services/assets/src \
backups/layer21-self-learning/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating learning database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_learning_models
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

model_type TEXT,

model_state JSONB,

accuracy NUMERIC DEFAULT 0,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_learning_models_asset
ON food_brain_learning_models(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_accuracy_history
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

prediction JSONB,

actual_result JSONB,

accuracy_score NUMERIC,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_accuracy_asset
ON food_brain_accuracy_history(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_strategy_memory
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

strategy TEXT,

result JSONB,

success_score NUMERIC,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_strategy_asset
ON food_brain_strategy_memory(asset_id);


SQL



echo "=== Creating learning engines ==="


mkdir -p services/assets/src/learning



cat > services/assets/src/learning/accuracyEngine.js <<'JS'

function calculate(prediction,actual){

let score=50;


if(
prediction.action === actual.action
){

score += 30;

}


if(
prediction.value &&
actual.value
){

const difference =
Math.abs(
prediction.value -
actual.value
);


if(difference < 10){

score +=20;

}

}


if(score>100){

score=100;

}


return score;

}


module.exports={
calculate
};

JS





cat > services/assets/src/learning/strategyLearningEngine.js <<'JS'

function evaluate(result){

if(result.success){

return {
score:90,
state:"SUCCESS"
};

}


return {
score:40,
state:"FAILED"
};

}


module.exports={
evaluate
};

JS





cat > services/assets/src/learning/selfLearningMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_learning_models
(
asset_id,
model_type,
model_state,
accuracy,
confidence
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.type,
JSON.stringify(data.state),
data.accuracy,
data.confidence
]
);


return result.rows[0];

}


module.exports={
remember
};

JS





cat > services/assets/src/learning/selfLearningEngine.js <<'JS'

const accuracy =
require("./accuracyEngine");

const memory =
require("./selfLearningMemoryEngine");



async function learn(assetId,data){


const score =
accuracy.calculate(
data.prediction,
data.actual
);



return await memory.remember({

assetId,

type:"EVOLUTION_MODEL",

state:{
lastPrediction:data.prediction,
lastActual:data.actual,
learningScore:score
},

accuracy:score,

confidence:score

});


}



module.exports={
learn
};

JS





echo "=== Creating learning routes ==="


cat > services/assets/src/routes/brainLearningRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const learning =
require("../learning/selfLearningEngine");



router.post("/learn/:assetId",async(req,res)=>{


try{

res.json(
await learning.learn(
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





echo "=== Register learning routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainLearningRoutes" not in text:

    text=text.replace(
    'const brainOrchestrationRoutes = require("./routes/brainOrchestrationRoutes");',
    '''const brainOrchestrationRoutes = require("./routes/brainOrchestrationRoutes");

const brainLearningRoutes = require("./routes/brainLearningRoutes");'''
    )


if 'app.use("/brain", brainLearningRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainOrchestrationRoutes);',
    '''app.use("/brain", brainOrchestrationRoutes);

app.use("/brain", brainLearningRoutes);'''
    )


p.write_text(text)

PY





echo "=== Testing Layer 21 modules ==="


node - <<'NODE'

require("./services/assets/src/learning/accuracyEngine");

require("./services/assets/src/learning/strategyLearningEngine");

require("./services/assets/src/learning/selfLearningEngine");


console.log(
"Layer 21 self learning loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 21 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test learning"
echo "3. commit + tag"

