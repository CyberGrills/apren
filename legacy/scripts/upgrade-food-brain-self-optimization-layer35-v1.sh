#!/bin/bash
set -e

echo "=== āprən Food Brain Self Optimization Intelligence Layer 35 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer35-self-optimization

cp -r services/assets/src \
backups/layer35-self-optimization/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating optimization database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_strategy_outcomes
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

strategy_type TEXT,

expected_result JSONB,

actual_result JSONB,

success_score NUMERIC DEFAULT 0,

learning_notes JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_strategy_outcomes_asset
ON food_brain_strategy_outcomes(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_strategy_learning
(
id SERIAL PRIMARY KEY,

strategy_type TEXT,

food_pattern TEXT,

performance_score NUMERIC DEFAULT 0,

usage_count INTEGER DEFAULT 0,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_strategy_learning_type
ON food_brain_strategy_learning(strategy_type);



SQL



echo "=== Creating optimization engines ==="


mkdir -p services/assets/src/optimization



cat > services/assets/src/optimization/strategyOutcomeEngine.js <<'JS'


const {pool}=require("../postgres");


async function record(data){


await pool.query(
`
INSERT INTO food_brain_strategy_outcomes
(
asset_id,
strategy_type,
expected_result,
actual_result,
success_score,
learning_notes
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
data.assetId,
data.strategy,
JSON.stringify(data.expected),
JSON.stringify(data.actual),
data.score,
JSON.stringify(data.notes || {})
]
);


return true;

}


module.exports={
record
};

JS



cat > services/assets/src/optimization/strategyPerformanceEngine.js <<'JS'


const {pool}=require("../postgres");


async function analyze(strategy){


const result =
await pool.query(
`
SELECT
AVG(success_score) as score,
COUNT(*) as usage
FROM food_brain_strategy_outcomes
WHERE strategy_type=$1
`,
[
strategy
]
);


const row=result.rows[0];


return {

strategy,

performance:
Number(row.score || 0),

usage:
Number(row.usage || 0)

};

}


module.exports={
analyze
};

JS



cat > services/assets/src/optimization/selfLearningEngine.js <<'JS'


const performance =
require("./strategyPerformanceEngine");

const {pool}=require("../postgres");



async function learn(data){


const analysis =
await performance.analyze(
data.strategy
);



let confidence =
analysis.performance;



await pool.query(
`
INSERT INTO food_brain_strategy_learning
(
strategy_type,
food_pattern,
performance_score,
usage_count,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
data.strategy,
data.pattern || "GENERAL",
analysis.performance,
analysis.usage,
confidence
]
);



return {

strategy:data.strategy,

learning:analysis

};

}



module.exports={
learn
};

JS



cat > services/assets/src/optimization/selfOptimizationBrain.js <<'JS'


const outcome =
require("./strategyOutcomeEngine");

const learner =
require("./selfLearningEngine");



async function optimize(assetId,data){


await outcome.record({

assetId,

strategy:data.strategy,

expected:data.expected,

actual:data.actual,

score:data.score,

notes:data.notes

});



const learning =
await learner.learn({

strategy:data.strategy,

pattern:data.pattern

});



return {

asset_id:assetId,

optimization:"COMPLETE",

learning

};


}



module.exports={
optimize
};

JS



echo "=== Creating optimization route ==="


cat > services/assets/src/routes/brainOptimizationRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const brain =
require("../optimization/selfOptimizationBrain");



router.post(
"/optimize/:assetId",
async(req,res)=>{

try{

res.json(
await brain.optimize(
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




echo "=== Register optimization route ==="



python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainOptimizationRoutes" not in text:

 text=text.replace(
 'const brainStrategyRoutes = require("./routes/brainStrategyRoutes");',
 '''const brainStrategyRoutes = require("./routes/brainStrategyRoutes");

const brainOptimizationRoutes = require("./routes/brainOptimizationRoutes");'''
 )


if 'app.use("/brain", brainOptimizationRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainStrategyRoutes);',
 '''app.use("/brain", brainStrategyRoutes);

app.use("/brain", brainOptimizationRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 35 modules ==="


node - <<'NODE'

require("./services/assets/src/optimization/strategyOutcomeEngine");

require("./services/assets/src/optimization/strategyPerformanceEngine");

require("./services/assets/src/optimization/selfLearningEngine");

require("./services/assets/src/optimization/selfOptimizationBrain");


console.log(
"Layer 35 self optimization intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 35 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test optimization brain"
echo "3. commit + tag"


