#!/bin/bash
set -e

echo "=== āprən Food Brain Executive Governor Engine v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-executive-governor-v1

cp -r services/assets/src \
backups/food-brain-executive-governor-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating governor modules ==="

mkdir -p services/assets/src/governor



cat > services/assets/src/governor/riskGovernor.js <<'JS'
function evaluate(data){

let risk="LOW";

let score=90;


if(data.freshness !== undefined &&
data.freshness < 20){

risk="HIGH";
score=40;

}

else if(
data.freshness !== undefined &&
data.freshness < 40
){

risk="MEDIUM";
score=65;

}


return {

risk,
score

};

}


module.exports={
evaluate
};
JS





cat > services/assets/src/governor/trustGovernor.js <<'JS'
function evaluate(data){

let trust="ACCEPTED";

let score=90;


if(
data.confidence !== undefined &&
data.confidence < 50
){

trust="REVIEW_REQUIRED";
score=40;

}


else if(
data.confidence !== undefined &&
data.confidence < 70
){

trust="MONITOR";
score=65;

}



return {

trust,
score

};

}


module.exports={
evaluate
};
JS





cat > services/assets/src/governor/economicGovernor.js <<'JS'
function evaluate(data){

let status="STABLE";


if(
data.value_drop &&
data.value_drop > 50
){

status="VALUE_PROTECTION";

}


return {

economic_status:status

};

}


module.exports={
evaluate
};
JS





cat > services/assets/src/governor/finalApprovalEngine.js <<'JS'
function approve(signals){


let decision="APPROVE";


if(
signals.risk === "HIGH"
){

decision="BLOCK";

}


if(
signals.trust === "REVIEW_REQUIRED"
){

decision="REVIEW";

}


return decision;

}



module.exports={
approve
};
JS





cat > services/assets/src/governor/executiveGovernorEngine.js <<'JS'
const risk =
require("./riskGovernor");


const trust =
require("./trustGovernor");


const economy =
require("./economicGovernor");


const approval =
require("./finalApprovalEngine");


const {pool}=require("../postgres");



async function govern(assetId,data){


const riskResult =
risk.evaluate(data);


const trustResult =
trust.evaluate(data);


const economyResult =
economy.evaluate(data);



const final =
approval.approve({

risk:riskResult.risk,

trust:trustResult.trust

});



const result =
await pool.query(
`
INSERT INTO food_brain_governor_decisions
(
asset_id,
risk,
trust,
economic_status,
decision,
signals
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
riskResult.risk,
trustResult.trust,
economyResult.economic_status,
final,
JSON.stringify({
risk:riskResult,
trust:trustResult,
economy:economyResult
})
]
);



return {

asset_id:assetId,

governor:{
risk:riskResult,
trust:trustResult,
economy:economyResult,
decision:final
},

record:result.rows[0]

};

}



module.exports={
govern
};
JS





echo "=== Creating governor database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_governor_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

risk TEXT,

trust TEXT,

economic_status TEXT,

decision TEXT,

signals JSONB,

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



if "executiveGovernorEngine" not in text:

    text=text.replace(
    'const agentOrchestrationEngine',
    '''const executiveGovernorEngine = require("./governor/executiveGovernorEngine");

const agentOrchestrationEngine'''
    )



routes="""


app.post("/brain/govern/:assetId", async(req,res)=>{

try{

res.json(
await executiveGovernorEngine.govern(
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


"""



if "/brain/govern/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY





echo "=== Testing governor modules ==="


node - <<'NODE'

require("./services/assets/src/governor/riskGovernor");

require("./services/assets/src/governor/trustGovernor");

require("./services/assets/src/governor/economicGovernor");

require("./services/assets/src/governor/finalApprovalEngine");

require("./services/assets/src/governor/executiveGovernorEngine");


console.log(
"Food brain executive governor loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 7 COMPLETE ==="

echo "Next:"
echo "1. restart assets service"
echo "2. test governor"
echo "3. git commit + tag"


