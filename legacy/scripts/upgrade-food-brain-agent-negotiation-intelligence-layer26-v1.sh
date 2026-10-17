#!/bin/bash
set -e

echo "=== āprən Food Brain Agent Negotiation Intelligence Layer 26 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer26-agent-negotiation

cp -r services/assets/src \
backups/layer26-agent-negotiation/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating negotiation database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_agent_arguments
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

agent TEXT,

position TEXT,

reasoning JSONB,

score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_agent_arguments_asset
ON food_brain_agent_arguments(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_negotiation_cycles
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

arguments JSONB,

winner_strategy TEXT,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_negotiation_cycles_asset
ON food_brain_negotiation_cycles(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_consensus_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

decision TEXT,

agent_votes JSONB,

confidence NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_consensus_asset
ON food_brain_consensus_decisions(asset_id);



SQL



echo "=== Creating negotiation engines ==="


mkdir -p services/assets/src/negotiation



cat > services/assets/src/negotiation/agentArgumentEngine.js <<'JS'

function argue(data){

return [

{
agent:"MARKET_AGENT",
position:"PROMOTE",
reason:{
reason:"HIGH_DEMAND"
},
score:90
},


{
agent:"FRESHNESS_AGENT",
position:"DISTRIBUTE_FAST",
reason:{
reason:"FRESHNESS_DECAY"
},
score:95
},


{
agent:"VALUE_AGENT",
position:"OPTIMIZE_PRICE",
reason:{
reason:"MAX_VALUE"
},
score:85
},


{
agent:"LOGISTICS_AGENT",
position:"LOCAL_MOVE",
reason:{
reason:"REDUCE_DISTANCE"
},
score:88
}

];

}


module.exports={
argue
};

JS



cat > services/assets/src/negotiation/agentDebateEngine.js <<'JS'

function debate(argumentsList){


return argumentsList.sort(
(a,b)=>
b.score-a.score
);


}


module.exports={
debate
};

JS



cat > services/assets/src/negotiation/consensusEngine.js <<'JS'

function decide(argumentsList){


const winner =
argumentsList[0];


return {

decision:winner.position,

winning_agent:winner.agent,

confidence:winner.score

};


}



module.exports={
decide
};

JS



cat > services/assets/src/negotiation/negotiationMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_negotiation_cycles
(
asset_id,
arguments,
winner_strategy,
confidence
)

VALUES($1,$2,$3,$4)

RETURNING *
`,
[
data.assetId,
JSON.stringify(data.arguments),
data.decision,
data.confidence
]
);


return result.rows[0];

}


module.exports={
remember
};

JS



cat > services/assets/src/negotiation/agentNegotiationBrainEngine.js <<'JS'

const argument =
require("./agentArgumentEngine");

const debate =
require("./agentDebateEngine");

const consensus =
require("./consensusEngine");

const memory =
require("./negotiationMemoryEngine");

const {pool}=require("../postgres");



async function negotiate(assetId,data){


const argumentsList =
argument.argue(data);



const ranked =
debate.debate(argumentsList);



const decision =
consensus.decide(ranked);



await memory.remember({

assetId,

arguments:ranked,

decision:decision.decision,

confidence:decision.confidence

});



await pool.query(
`
INSERT INTO food_brain_consensus_decisions
(
asset_id,
decision,
agent_votes,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
decision.decision,
JSON.stringify(ranked),
decision.confidence
]
);



return {

asset_id:assetId,

negotiation:ranked,

consensus:decision

};


}



module.exports={
negotiate
};

JS



echo "=== Creating negotiation route ==="


cat > services/assets/src/routes/brainNegotiationRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const brain =
require("../negotiation/agentNegotiationBrainEngine");



router.post(
"/agents/negotiate/:assetId",
async(req,res)=>{

try{

res.json(
await brain.negotiate(
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



echo "=== Register negotiation route ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainNegotiationRoutes" not in text:

 text=text.replace(
 'const brainGraphRoutes = require("./routes/brainGraphRoutes");',
 '''const brainGraphRoutes = require("./routes/brainGraphRoutes");

const brainNegotiationRoutes = require("./routes/brainNegotiationRoutes");'''
 )


if 'app.use("/brain", brainNegotiationRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainGraphRoutes);',
 '''app.use("/brain", brainGraphRoutes);

app.use("/brain", brainNegotiationRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 26 modules ==="


node - <<'NODE'

require("./services/assets/src/negotiation/agentArgumentEngine");

require("./services/assets/src/negotiation/agentDebateEngine");

require("./services/assets/src/negotiation/consensusEngine");

require("./services/assets/src/negotiation/agentNegotiationBrainEngine");


console.log(
"Layer 26 negotiation intelligence loaded"
);

NODE



node --check services/assets/src/server.js


echo

echo "=== LAYER 26 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test negotiation"
echo "3. commit + tag"

