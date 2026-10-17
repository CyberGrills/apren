#!/bin/bash
set -e

echo "=== āprən Food Brain Self-Learning Memory Layer 14 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer14-self-learning

cp -r services/assets/src \
backups/layer14-self-learning/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating learning database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_learning_memory
(

id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

decision TEXT,

execution_result JSONB,

outcome_status TEXT,

confidence_before NUMERIC,

confidence_after NUMERIC,

learning_signal TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


CREATE INDEX IF NOT EXISTS idx_learning_asset
ON food_brain_learning_memory(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_learning_patterns
(

id SERIAL PRIMARY KEY,

pattern_type TEXT,

pattern_key TEXT,

success_count INTEGER DEFAULT 0,

failure_count INTEGER DEFAULT 0,

confidence_adjustment NUMERIC DEFAULT 0,

updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_learning_pattern
ON food_brain_learning_patterns(pattern_key);


SQL



echo "=== Creating learning modules ==="


mkdir -p services/assets/src/learning



cat > services/assets/src/learning/outcomeEvaluationEngine.js <<'JS'

function evaluate(result){


let status="UNKNOWN";

let signal="NEUTRAL";


if(result.status==="SUCCESS" ||
result.status==="SIMULATED"){

status="SUCCESS";

signal="POSITIVE";

}



if(result.status==="FAILED"){

status="FAILURE";

signal="NEGATIVE";

}



return {

status,

signal

};

}



module.exports={
evaluate
};

JS





cat > services/assets/src/learning/confidenceAdaptationEngine.js <<'JS'

function adapt(confidence,status){


let updated=Number(confidence || 0);


if(status==="SUCCESS"){

updated += 5;

}


if(status==="FAILURE"){

updated -= 10;

}


if(updated>100){

updated=100;

}


if(updated<0){

updated=0;

}



return updated;

}



module.exports={
adapt
};

JS





cat > services/assets/src/learning/learningMemoryEngine.js <<'JS'

const {pool}=require("../postgres");



async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_learning_memory
(
asset_id,
decision,
execution_result,
outcome_status,
confidence_before,
confidence_after,
learning_signal
)

VALUES
($1,$2,$3,$4,$5,$6,$7)

RETURNING *
`,
[
data.assetId,
data.decision,
JSON.stringify(data.result),
data.status,
data.confidenceBefore,
data.confidenceAfter,
data.signal
]
);


return result.rows[0];

}





async function history(assetId){


const result =
await pool.query(
`
SELECT *

FROM food_brain_learning_memory

WHERE asset_id=$1

ORDER BY created_at DESC
`,
[
assetId
]
);


return result.rows;

}



module.exports={
remember,
history
};

JS





cat > services/assets/src/learning/selfLearningEngine.js <<'JS'

const evaluator =
require("./outcomeEvaluationEngine");

const adaptation =
require("./confidenceAdaptationEngine");

const memory =
require("./learningMemoryEngine");



async function learn(assetId,data){


const evaluation =
evaluator.evaluate(
data.result
);



const newConfidence =
adaptation.adapt(
data.confidence || 0,
evaluation.status
);



return await memory.remember({

assetId,

decision:data.decision,

result:data.result,

status:evaluation.status,

confidenceBefore:data.confidence || 0,

confidenceAfter:newConfidence,

signal:evaluation.signal

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


const memory =
require("../learning/learningMemoryEngine");



router.post("/learning/outcome/:assetId",async(req,res)=>{

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




router.get("/learning/history/:assetId",async(req,res)=>{


res.json(
await memory.history(
req.params.assetId
)
);


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
    'const brainTrustAuditRoutes = require("./routes/brainTrustAuditRoutes");',
    '''const brainTrustAuditRoutes = require("./routes/brainTrustAuditRoutes");

const brainLearningRoutes = require("./routes/brainLearningRoutes");'''
    )


if 'app.use("/brain", brainLearningRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainTrustAuditRoutes);',
    '''app.use("/brain", brainTrustAuditRoutes);

app.use("/brain", brainLearningRoutes);'''
    )


p.write_text(text)

PY




echo "=== Testing Layer 14 modules ==="


node - <<'NODE'

require("./services/assets/src/learning/outcomeEvaluationEngine");

require("./services/assets/src/learning/confidenceAdaptationEngine");

require("./services/assets/src/learning/selfLearningEngine");


console.log(
"Layer 14 self learning loaded"
);


NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 14 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test learning cycle"
echo "3. commit + tag"

