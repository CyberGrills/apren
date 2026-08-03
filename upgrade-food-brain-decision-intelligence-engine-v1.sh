#!/bin/bash
set -e

echo "=== āprən Food Brain Decision Intelligence Engine v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-decision-v1

cp -r services/assets/src \
backups/food-brain-decision-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating decision modules ==="

mkdir -p services/assets/src/decision



cat > services/assets/src/decision/actionSelector.js <<'JS'
function select(signals){

let action="HOLD";

let priority="MEDIUM";

let reason="Market conditions stable";



if(
signals.freshness < 30 &&
signals.demand > 70
){

action="FAST_MOVE";

priority="HIGH";

reason="Freshness risk with strong demand";

}

else if(
signals.demand > 80 &&
signals.freshness > 70
){

action="PROMOTE";

priority="HIGH";

reason="High demand and strong freshness";

}

else if(
signals.supply < signals.demand
){

action="INCREASE_SUPPLY";

priority="MEDIUM";

reason="Demand exceeds available supply";

}



return {

action,

priority,

reason

};

}


module.exports={
select
};
JS





cat > services/assets/src/decision/confidenceDecisionEngine.js <<'JS'
function calculate(signals){


let confidence=50;



if(
signals.freshness !== undefined
){

confidence+=10;

}


if(
signals.demand !== undefined
){

confidence+=10;

}


if(
signals.prediction_confidence
){

confidence+=signals.prediction_confidence / 5;

}



return Math.min(
100,
Math.round(confidence)
);


}



module.exports={
calculate
};
JS





cat > services/assets/src/decision/recommendationEngine.js <<'JS'
const action =
require("./actionSelector");


const confidence =
require("./confidenceDecisionEngine");



function recommend(data){


const decision =
action.select(data);



const score =
confidence.calculate(data);



return {

action:
decision.action,

priority:
decision.priority,

reason:
decision.reason,

confidence:
score

};

}



module.exports={
recommend
};
JS





cat > services/assets/src/decision/decisionEngine.js <<'JS'
const {pool}=require("../postgres");


const recommendation =
require("./recommendationEngine");



async function decide(assetId,data){


const decision =
recommendation.recommend(data);



const result =
await pool.query(
`
INSERT INTO food_brain_decisions
(
asset_id,
decision,
confidence,
priority
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
JSON.stringify(decision),
decision.confidence,
decision.priority
]
);



return {

asset_id:assetId,

decision,

record:result.rows[0]

};

}




async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_decisions
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
decide,
history
};

JS





echo "=== Creating decision database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

decision JSONB,

confidence NUMERIC(5,2),

priority TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_decisions_asset
ON food_brain_decisions(asset_id);



SQL





echo "=== Adding decision routes ==="


python3 <<'PY'

from pathlib import Path


path=Path(
"services/assets/src/server.js"
)


text=path.read_text()



if "decisionEngine" not in text:

    text=text.replace(
    'const learningEngine',
    '''const decisionEngine = require("./decision/decisionEngine");

const learningEngine'''
    )



routes="""


app.post("/brain/decision/:assetId", async(req,res)=>{

try{

res.json(
await decisionEngine.decide(
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



app.get("/brain/decision/history/:assetId", async(req,res)=>{

try{

res.json(
await decisionEngine.history(
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



if "/brain/decision/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]



path.write_text(text)

PY





echo "=== Testing decision modules ==="


node - <<'NODE'

require("./services/assets/src/decision/actionSelector");

require("./services/assets/src/decision/confidenceDecisionEngine");

require("./services/assets/src/decision/recommendationEngine");

require("./services/assets/src/decision/decisionEngine");


console.log(
"Food brain decision intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. ./restart-assets-clean-v1.sh"
echo "2. test decision endpoint"
echo "3. git commit + tag"


