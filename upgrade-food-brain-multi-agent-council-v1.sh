#!/bin/bash
set -e

echo "=== āprən Food Brain Multi Agent Council v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-agent-council-v1

cp -r services/assets/src \
backups/food-brain-agent-council-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating agent modules ==="

mkdir -p services/assets/src/agents



cat > services/assets/src/agents/freshnessAgent.js <<'JS'
function analyze(data){

let vote="NEUTRAL";
let confidence=50;


const freshness =
Number(data.freshness || 0);


if(freshness <= 0){

vote="BLOCK";
confidence=99;

}
else if(freshness < 30){

vote="FAST_MOVE";
confidence=85;

}
else if(freshness > 80){

vote="KEEP_ACTIVE";
confidence=80;

}


return {
agent:"FRESHNESS_AGENT",
vote,
confidence
};

}


module.exports={analyze};
JS



cat > services/assets/src/agents/marketAgent.js <<'JS'
function analyze(data){

let vote="NEUTRAL";
let confidence=50;


const demand =
Number(data.demand || 0);


if(demand > 80){

vote="PROMOTE";
confidence=85;

}
else if(demand < 30){

vote="DISCOUNT";
confidence=70;

}


return {
agent:"MARKET_AGENT",
vote,
confidence
};

}


module.exports={analyze};
JS



cat > services/assets/src/agents/trustAgent.js <<'JS'
function analyze(data){

let vote="TRUSTED";
let confidence=70;


const trust =
Number(data.trust || 0);


if(trust < 30){

vote="REVIEW";
confidence=90;

}


return {
agent:"TRUST_AGENT",
vote,
confidence
};

}


module.exports={analyze};
JS



cat > services/assets/src/agents/agentCouncilEngine.js <<'JS'
const {pool}=require("../postgres");


const freshness =
require("./freshnessAgent");

const market =
require("./marketAgent");

const trust =
require("./trustAgent");



async function decide(assetId){


const asset =
await pool.query(
`
SELECT *
FROM food_assets
WHERE id=$1
`,
[assetId]
);


if(!asset.rows[0]){

throw new Error("Asset not found");

}


const item=asset.rows[0];


const context={

freshness:item.freshness_score,

demand:item.demand_score,

trust:item.trust_score

};



const votes=[

freshness.analyze(context),

market.analyze(context),

trust.analyze(context)

];



let finalDecision="MONITOR";



if(
votes.some(
v=>v.vote==="BLOCK"
)
){

finalDecision="BLOCK_TRADE";

}

else if(
votes.some(
v=>v.vote==="FAST_MOVE"
)
){

finalDecision="FAST_MOVE";

}

else if(
votes.some(
v=>v.vote==="PROMOTE"
)
){

finalDecision="PROMOTE";

}



const confidence =
Math.round(
votes.reduce(
(a,b)=>a+b.confidence,
0
)
/ votes.length
);



const result =
await pool.query(
`
INSERT INTO food_brain_council_decisions
(
asset_id,
decision,
votes,
confidence
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
finalDecision,
JSON.stringify(votes),
confidence
]
);



return {

asset_id:assetId,

decision:finalDecision,

confidence,

votes,

record:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_council_decisions
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);

return result.rows;

}



module.exports={
decide,
history
};
JS




echo "=== Creating council tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_council_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

decision TEXT,

votes JSONB,

confidence NUMERIC(5,2),

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_council_asset
ON food_brain_council_decisions(asset_id);


SQL




echo "=== Adding council routes ==="


python3 <<'PY'

from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "agentCouncilEngine" not in text:

    text=text.replace(
    'const optimizationEngine',
    '''const agentCouncilEngine = require("./agents/agentCouncilEngine");

const optimizationEngine'''
    )



routes="""

app.post("/brain/council/:assetId", async(req,res)=>{

try{

res.json(
await agentCouncilEngine.decide(
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


app.get("/brain/council/history/:assetId", async(req,res)=>{

try{

res.json(
await agentCouncilEngine.history(
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


if "/brain/council/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY



echo "=== Testing agents ==="


node - <<'NODE'

require("./services/assets/src/agents/freshnessAgent");

require("./services/assets/src/agents/marketAgent");

require("./services/assets/src/agents/trustAgent");

require("./services/assets/src/agents/agentCouncilEngine");

console.log(
"Food brain multi agent council loaded"
);

NODE



echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test council"

