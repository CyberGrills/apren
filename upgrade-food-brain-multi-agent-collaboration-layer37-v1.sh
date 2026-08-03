#!/bin/bash
set -e

echo "=== āprən Food Brain Multi-Agent Collaboration Intelligence Layer 37 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer37-multi-agent

cp -r services/assets/src \
backups/layer37-multi-agent/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating agent collaboration database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_agents
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

agent_name TEXT,

signal TEXT,

recommendation TEXT,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_agents_asset
ON food_brain_agents(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_agent_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

participating_agents JSONB,

final_decision TEXT,

consensus_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_agent_decisions_asset
ON food_brain_agent_decisions(asset_id);



SQL



echo "=== Creating agent engines ==="


mkdir -p services/assets/src/agents



cat > services/assets/src/agents/freshnessAgent.js <<'JS'

function analyze(data){

if(data.freshness < 15){

return {
agent:"freshness",
signal:"CRITICAL",
recommendation:"MOVE_FAST",
confidence:95
};

}

if(data.freshness < 30){

return {
agent:"freshness",
signal:"WARNING",
recommendation:"MONITOR",
confidence:75
};

}


return {
agent:"freshness",
signal:"STABLE",
recommendation:"HOLD",
confidence:60
};

}


module.exports={analyze};

JS





cat > services/assets/src/agents/demandAgent.js <<'JS'


function analyze(data){


if(data.demand==="HIGH"){

return {

agent:"demand",

signal:"HIGH",

recommendation:"INCREASE_VISIBILITY",

confidence:90

};

}


return {

agent:"demand",

signal:"NORMAL",

recommendation:"MONITOR",

confidence:60

};


}


module.exports={analyze};

JS





cat > services/assets/src/agents/valueAgent.js <<'JS'


function analyze(data){


if(data.valueRisk==="HIGH"){

return {

agent:"value",

signal:"RISK",

recommendation:"PROTECT_VALUE",

confidence:85

};

}



return {

agent:"value",

signal:"STABLE",

recommendation:"MAINTAIN",

confidence:65

};


}


module.exports={analyze};

JS






cat > services/assets/src/agents/wasteAgent.js <<'JS'


function analyze(data){


if(data.wasteRisk==="HIGH" || data.freshness < 20){


return {

agent:"waste",

signal:"RISK",

recommendation:"REDIRECT",

confidence:95

};

}



return {

agent:"waste",

signal:"LOW",

recommendation:"NORMAL_FLOW",

confidence:60

};


}


module.exports={analyze};


JS





cat > services/assets/src/agents/marketAgent.js <<'JS'


function analyze(data){


if(data.supply==="LOW" && data.demand==="HIGH"){


return {

agent:"market",

signal:"OPPORTUNITY",

recommendation:"MAXIMIZE_DISTRIBUTION",

confidence:90

};

}



return {

agent:"market",

signal:"BALANCED",

recommendation:"NORMAL_TRADING",

confidence:60

};


}


module.exports={analyze};


JS





cat > services/assets/src/agents/agentCollaborationEngine.js <<'JS'


const freshness =
require("./freshnessAgent");

const demand =
require("./demandAgent");

const value =
require("./valueAgent");

const waste =
require("./wasteAgent");

const market =
require("./marketAgent");


const {pool}=require("../postgres");



async function collaborate(assetId,data){


const agents=[

freshness.analyze(data),

demand.analyze(data),

value.analyze(data),

waste.analyze(data),

market.analyze(data)

];



let decision="NORMAL_FLOW";

let score=0;



for(const agent of agents){

score += agent.confidence;


if(
agent.recommendation==="MOVE_FAST" ||
agent.recommendation==="REDIRECT"
){

decision="FAST_DISTRIBUTION";

}

}



let consensus =
Math.round(score / agents.length);



await pool.query(
`
INSERT INTO food_brain_agent_decisions
(
asset_id,
participating_agents,
final_decision,
consensus_score
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
JSON.stringify(agents),
decision,
consensus
]
);



for(const agent of agents){

await pool.query(
`
INSERT INTO food_brain_agents
(
asset_id,
agent_name,
signal,
recommendation,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
agent.agent,
agent.signal,
agent.recommendation,
agent.confidence
]
);

}



return {

asset_id:assetId,

agents,

consensus:{
decision,
confidence:consensus
}

};


}



module.exports={
collaborate
};


JS





echo "=== Creating agent route ==="


cat > services/assets/src/routes/brainAgentRoutes.js <<'JS'


const express=require("express");

const router=express.Router();


const brain =
require("../agents/agentCollaborationEngine");



router.post(
"/agents/:assetId",
async(req,res)=>{

try{

res.json(
await brain.collaborate(
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






echo "=== Register agent route ==="



python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainAgentRoutes" not in text:

 text=text.replace(
 'const brainCycleRoutes = require("./routes/brainCycleRoutes");',
 '''const brainCycleRoutes = require("./routes/brainCycleRoutes");

const brainAgentRoutes = require("./routes/brainAgentRoutes");'''
 )


if 'app.use("/brain", brainAgentRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainCycleRoutes);',
 '''app.use("/brain", brainCycleRoutes);

app.use("/brain", brainAgentRoutes);'''
 )


p.write_text(text)

PY





echo "=== Testing Layer 37 modules ==="


node - <<'NODE'

require("./services/assets/src/agents/freshnessAgent");

require("./services/assets/src/agents/demandAgent");

require("./services/assets/src/agents/valueAgent");

require("./services/assets/src/agents/wasteAgent");

require("./services/assets/src/agents/marketAgent");

require("./services/assets/src/agents/agentCollaborationEngine");


console.log(
"Layer 37 multi-agent collaboration intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 37 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test agent collaboration"
echo "3. commit + tag"


