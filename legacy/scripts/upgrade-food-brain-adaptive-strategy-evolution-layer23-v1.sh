#!/bin/bash
set -e

echo "=== āprən Food Brain Adaptive Strategy Evolution Layer 23 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer23-adaptive-strategy

cp -r services/assets/src \
backups/layer23-adaptive-strategy/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating strategy evolution database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_strategies
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

strategy TEXT,

context JSONB,

confidence NUMERIC DEFAULT 0,

usage_count INTEGER DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_strategy_asset
ON food_brain_strategies(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_strategy_results
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

strategy_id INTEGER,

result_data JSONB,

success_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_strategy_results_asset
ON food_brain_strategy_results(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_strategy_evolution
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

previous_strategy TEXT,

new_strategy TEXT,

reason JSONB,

evolution_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_strategy_evolution_asset
ON food_brain_strategy_evolution(asset_id);


SQL



echo "=== Creating strategy engines ==="


mkdir -p services/assets/src/strategy



cat > services/assets/src/strategy/strategyMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(data){

const result =
await pool.query(
`
INSERT INTO food_brain_strategies
(
asset_id,
strategy,
context,
confidence,
usage_count
)

VALUES
($1,$2,$3,$4,1)

RETURNING *
`,
[
data.assetId,
data.strategy,
JSON.stringify(data.context),
data.confidence
]
);


return result.rows[0];

}



module.exports={
remember
};

JS





cat > services/assets/src/strategy/strategyScoreEngine.js <<'JS'

function score(result){

let score=50;


if(result.sales){

score += Math.min(
30,
result.sales / 10
);

}


if(result.waste){

score -= Math.min(
20,
result.waste
);

}


if(result.profit){

score += Math.min(
20,
result.profit / 10
);

}


if(score>100)
score=100;


if(score<0)
score=0;


return score;

}



module.exports={
score
};

JS





cat > services/assets/src/strategy/strategyRankingEngine.js <<'JS'

function rank(strategies){


return strategies.sort(
(a,b)=>
b.score-a.score
);


}



module.exports={
rank
};

JS





cat > services/assets/src/strategy/strategyEvolutionEngine.js <<'JS'

const scoreEngine =
require("./strategyScoreEngine");

const ranking =
require("./strategyRankingEngine");

const memory =
require("./strategyMemoryEngine");



async function evolve(assetId,data){


const score =
scoreEngine.score(
data.result
);



const strategies=[

{
strategy:data.previousStrategy,
score
},

{
strategy:"PROMOTE",
score:score + 5
},

{
strategy:"TRADE",
score:score + 3
},

{
strategy:"HOLD",
score:score - 10
}

];



const ranked =
ranking.rank(strategies);



const best =
ranked[0];



return await memory.remember({

assetId,

strategy:
best.strategy,

context:{
previous:data.previousStrategy,
result:data.result,
ranking:ranked
},

confidence:
best.score

});


}



module.exports={
evolve
};

JS





cat > services/assets/src/strategy/adaptiveStrategyEngine.js <<'JS'

const evolution =
require("./strategyEvolutionEngine");


const {pool}=require("../postgres");



async function adapt(assetId,data){


const evolved =
await evolution.evolve(
assetId,
data
);



await pool.query(
`
INSERT INTO food_brain_strategy_evolution
(
asset_id,
previous_strategy,
new_strategy,
reason,
evolution_score
)

VALUES
($1,$2,$3,$4,$5)
`,
[
assetId,
data.previousStrategy,
evolved.strategy,
JSON.stringify(data.result),
evolved.confidence
]
);



return {

asset_id:assetId,

adaptive_strategy:evolved.strategy,

confidence:evolved.confidence,

message:
"Strategy evolved from experience"

};

}



module.exports={
adapt
};

JS




echo "=== Creating strategy route ==="


cat > services/assets/src/routes/brainStrategyRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const strategy =
require("../strategy/adaptiveStrategyEngine");



router.post(
"/strategy/evolve/:assetId",
async(req,res)=>{

try{

res.json(
await strategy.adapt(
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





echo "=== Register strategy routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainStrategyRoutes" not in text:

 text=text.replace(
 'const brainWorldModelRoutes = require("./routes/brainWorldModelRoutes");',
 '''const brainWorldModelRoutes = require("./routes/brainWorldModelRoutes");

const brainStrategyRoutes = require("./routes/brainStrategyRoutes");'''
 )



if 'app.use("/brain", brainStrategyRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainWorldModelRoutes);',
 '''app.use("/brain", brainWorldModelRoutes);

app.use("/brain", brainStrategyRoutes);'''
 )


p.write_text(text)

PY





echo "=== Testing Layer 23 modules ==="


node - <<'NODE'

require("./services/assets/src/strategy/strategyMemoryEngine");

require("./services/assets/src/strategy/strategyScoreEngine");

require("./services/assets/src/strategy/strategyRankingEngine");

require("./services/assets/src/strategy/strategyEvolutionEngine");

require("./services/assets/src/strategy/adaptiveStrategyEngine");


console.log(
"Layer 23 adaptive strategy evolution loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 23 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test strategy evolution"
echo "3. commit + tag"


