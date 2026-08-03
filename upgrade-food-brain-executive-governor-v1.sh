#!/bin/bash
set -e

echo "=== āprən Food Brain Executive Governor v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-governor-v1

cp -r services/assets/src \
backups/food-brain-governor-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating governor modules ==="

mkdir -p services/assets/src/governor



cat > services/assets/src/governor/safetyGovernor.js <<'JS'
function check(data){

let allowed=true;
let reason="Safety checks passed";


if(
data.decision==="BLOCK_TRADE"
){

allowed=true;
reason="Blocking trade is allowed for food safety";

}


if(
data.confidence < 40
){

allowed=false;
reason="Confidence too low";

}


return {

allowed,

reason

};

}


module.exports={check};
JS



cat > services/assets/src/governor/confidenceGovernor.js <<'JS'
function evaluate(votes){

const scores =
votes.map(
v=>Number(v.confidence)
);


const confidence =
Math.round(
scores.reduce(
(a,b)=>a+b,
0
)
/scores.length
);


let status="NORMAL";


if(confidence>=80){

status="HIGH_CONFIDENCE";

}
else if(confidence<50){

status="LOW_CONFIDENCE";

}


return {

confidence,

status

};

}


module.exports={evaluate};
JS



cat > services/assets/src/governor/executiveGovernor.js <<'JS'
const {pool}=require("../postgres");


const council =
require("../agents/agentCouncilEngine");


const safety =
require("./safetyGovernor");


const confidence =
require("./confidenceGovernor");



async function govern(assetId){


const councilDecision =
await council.decide(assetId);



const confidenceResult =
confidence.evaluate(
councilDecision.votes
);



const safetyResult =
safety.check({

decision:councilDecision.decision,

confidence:
confidenceResult.confidence

});



let finalDecision =
councilDecision.decision;



if(
!safetyResult.allowed
){

finalDecision="REVIEW";

}



const result =
await pool.query(
`
INSERT INTO food_brain_governor_decisions
(
asset_id,
council_decision,
final_decision,
confidence,
safety_result
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
assetId,
councilDecision.decision,
finalDecision,
confidenceResult.confidence,
JSON.stringify(safetyResult)
]
);



return {

asset_id:assetId,

council_decision:
councilDecision.decision,

final_decision:
finalDecision,

confidence:
confidenceResult,

safety:
safetyResult,

record:
result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_governor_decisions
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);


return result.rows;

}



module.exports={
govern,
history
};
JS




echo "=== Creating governor tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_governor_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

council_decision TEXT,

final_decision TEXT,

confidence NUMERIC(5,2),

safety_result JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_governor_asset
ON food_brain_governor_decisions(asset_id);


SQL




echo "=== Adding governor routes ==="


python3 <<'PY'

from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "executiveGovernor" not in text:

    text=text.replace(
    'const agentCouncilEngine',
    '''const executiveGovernor = require("./governor/executiveGovernor");

const agentCouncilEngine'''
    )



routes="""

app.post("/brain/govern/:assetId", async(req,res)=>{

try{

res.json(
await executiveGovernor.govern(
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


app.get("/brain/govern/history/:assetId", async(req,res)=>{

try{

res.json(
await executiveGovernor.history(
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


if "/brain/govern/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY



echo "=== Testing governor modules ==="


node - <<'NODE'

require("./services/assets/src/governor/safetyGovernor");

require("./services/assets/src/governor/confidenceGovernor");

require("./services/assets/src/governor/executiveGovernor");

console.log(
"Food brain executive governor loaded"
);

NODE



echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test governor"

