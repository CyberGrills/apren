#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Decision Engine Layer 18 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer18-autonomous-decision

cp -r services/assets/src \
backups/layer18-autonomous-decision/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating decision database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

reasoning JSONB,

signals JSONB,

confidence NUMERIC DEFAULT 0,

execution_mode TEXT DEFAULT 'ASSISTED',

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_brain_decisions_asset
ON food_brain_decisions(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_action_scores
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

action TEXT,

score NUMERIC,

reason TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);



CREATE INDEX IF NOT EXISTS idx_action_scores_asset
ON food_brain_action_scores(asset_id);


SQL



echo "=== Creating decision engines ==="


mkdir -p services/assets/src/decision



cat > services/assets/src/decision/actionRankingEngine.js <<'JS'

function rank(actions){


return actions.sort(
(a,b)=>b.score-a.score
);


}


module.exports={
rank
};

JS





cat > services/assets/src/decision/reasoningEngine.js <<'JS'

function explain(data){


let reasons=[];


if(data.freshness < 50){

reasons.push(
"freshness window declining"
);

}


if(data.demand==="HIGH"){

reasons.push(
"market demand increasing"
);

}


if(data.simulationRisk==="HIGH"){

reasons.push(
"value loss risk detected"
);

}


if(data.autonomy==="AUTONOMOUS"){

reasons.push(
"user permits autonomous optimization"
);

}


return reasons;

}


module.exports={
explain
};

JS





cat > services/assets/src/decision/decisionEngine.js <<'JS'

const ranking =
require("./actionRankingEngine");

const reasoning =
require("./reasoningEngine");



function decide(data){


let actions=[

{
action:"HOLD",
score:40
},

{
action:"PROMOTE",
score:60
},

{
action:"SELL_NOW",
score:50
},

{
action:"TRADE",
score:45
}

];



if(data.freshness < 40){

actions.find(
x=>x.action==="SELL_NOW"
).score += 40;

}



if(data.demand==="HIGH"){

actions.find(
x=>x.action==="PROMOTE"
).score += 30;

}



const ranked =
ranking.rank(actions);



return {

action:
ranked[0].action,

confidence:
Math.min(
95,
ranked[0].score
),

reasoning:
reasoning.explain(data)

};

}



module.exports={
decide
};

JS





cat > services/assets/src/decision/decisionMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_decisions
(
asset_id,
action,
reasoning,
signals,
confidence,
execution_mode
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.assetId,
data.action,
JSON.stringify(data.reasoning),
JSON.stringify(data.signals),
data.confidence,
data.mode
]
);


return result.rows[0];

}


async function history(assetId){


const result =
await pool.query(
`
SELECT *

FROM food_brain_decisions

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





cat > services/assets/src/decision/autonomousDecisionEngine.js <<'JS'

const decision =
require("./decisionEngine");

const memory =
require("./decisionMemoryEngine");



async function evaluate(assetId,data){


const result =
decision.decide(data);



return await memory.remember({

assetId,

action:
result.action,

reasoning:
result.reasoning,

signals:data,

confidence:
result.confidence,

mode:
data.autonomy || "ASSISTED"

});


}


module.exports={
evaluate
};

JS





echo "=== Creating decision routes ==="


cat > services/assets/src/routes/brainDecisionRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const decision =
require("../decision/autonomousDecisionEngine");


const memory =
require("../decision/decisionMemoryEngine");



router.post("/decision/:assetId",async(req,res)=>{

try{


res.json(
await decision.evaluate(
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




router.get("/decision/history/:assetId",async(req,res)=>{


res.json(
await memory.history(
req.params.assetId
)
);


});


module.exports=router;

JS





echo "=== Register decision routes ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainDecisionRoutes" not in text:

    text=text.replace(
    'const brainSimulationRoutes = require("./routes/brainSimulationRoutes");',
    '''const brainSimulationRoutes = require("./routes/brainSimulationRoutes");

const brainDecisionRoutes = require("./routes/brainDecisionRoutes");'''
    )



if 'app.use("/brain", brainDecisionRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainSimulationRoutes);',
    '''app.use("/brain", brainSimulationRoutes);

app.use("/brain", brainDecisionRoutes);'''
    )


p.write_text(text)

PY





echo "=== Testing Layer 18 modules ==="


node - <<'NODE'

require("./services/assets/src/decision/actionRankingEngine");

require("./services/assets/src/decision/reasoningEngine");

require("./services/assets/src/decision/decisionEngine");

require("./services/assets/src/decision/autonomousDecisionEngine");


console.log(
"Layer 18 autonomous decision loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 18 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test decision engine"
echo "3. commit + tag"

