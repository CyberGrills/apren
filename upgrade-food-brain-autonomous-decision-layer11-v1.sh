#!/bin/bash
set -e

echo "=== āprən Food Brain Autonomous Decision Engine Layer 11 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer11-autonomous-decision

cp -r services/assets/src \
backups/layer11-autonomous-decision/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating autonomous decision modules ==="


mkdir -p services/assets/src/decision



cat > services/assets/src/decision/actionScoringEngine.js <<'JS'
function score(simulation){

let score = 0;


const impact =
simulation.impact?.scores || {};


score += impact.value_protection || 0;
score += impact.waste_prevention || 0;
score += impact.user_benefit || 0;


return score;

}


module.exports = {
score
};
JS





cat > services/assets/src/decision/actionSelector.js <<'JS'
const scorer =
require("./actionScoringEngine");


function select(simulations){


let best=null;
let highest=-1;


for(const simulation of simulations){


const score =
scorer.score(simulation);


if(score > highest){

highest=score;

best={
scenario:simulation.scenario,
score
};

}

}


return best;

}



module.exports={
select
};
JS





cat > services/assets/src/decision/reasoningEngine.js <<'JS'
function explain(decision){


const reasons={

SELL_NOW:
"Immediate movement preserves current food value",

HOLD:
"Holding allows future market opportunity",

PROMOTE:
"Promotion increases demand and reduces waste risk",

TRADE:
"Exchange improves asset utility"

};


return {

decision:decision.scenario,

reason:
reasons[decision.scenario]
||
"Optimized by food brain"

};

}


module.exports={
explain
};
JS





cat > services/assets/src/decision/autonomousDecisionEngine.js <<'JS'
const selector =
require("./actionSelector");


const reasoning =
require("./reasoningEngine");


const {pool}=require("../postgres");



async function decide(assetId, simulations){


const selected =
selector.select(simulations);


const explanation =
reasoning.explain(selected);



const result =
await pool.query(
`
INSERT INTO food_brain_autonomous_decisions
(
asset_id,
decision,
reason,
confidence,
simulation_score
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
assetId,
selected.scenario,
explanation.reason,
selected.score >=200 ? 90 : 70,
selected.score
]
);



return {

asset_id:assetId,

autonomous_decision:selected,

reasoning:explanation,

record:result.rows[0]

};


}



module.exports={
decide
};
JS





echo "=== Creating database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_autonomous_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

decision TEXT,

reason TEXT,

confidence NUMERIC,

simulation_score NUMERIC,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_autonomous_decision_asset
ON food_brain_autonomous_decisions(asset_id);



SQL





echo "=== Adding routes ==="


python3 <<'PY'

from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "autonomousDecisionEngine" not in text:

    text=text.replace(
    'const predictiveSimulationEngine',
    '''const autonomousDecisionEngine = require("./decision/autonomousDecisionEngine");

const predictiveSimulationEngine'''
    )



route="""

app.post("/brain/decision/:assetId", async(req,res)=>{

try{

res.json(
await autonomousDecisionEngine.decide(
req.params.assetId,
req.body.simulations
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


if "/brain/decision/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+route+text[insert:]


path.write_text(text)

PY





echo "=== Testing modules ==="


node - <<'NODE'

require("./services/assets/src/decision/actionScoringEngine");

require("./services/assets/src/decision/actionSelector");

require("./services/assets/src/decision/reasoningEngine");

require("./services/assets/src/decision/autonomousDecisionEngine");


console.log(
"Layer 11 autonomous decision loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 11 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test autonomous decision"
echo "3. commit + tag"


