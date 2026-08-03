#!/bin/bash
set -e

echo "=== āprən Food Brain Economy Graph Intelligence Layer 25 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer25-economy-graph

cp -r services/assets/src \
backups/layer25-economy-graph/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating economy graph database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_graph_nodes
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

node_type TEXT,

node_name TEXT,

node_data JSONB,

importance NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_graph_nodes_asset
ON food_brain_graph_nodes(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_graph_edges
(
id SERIAL PRIMARY KEY,

source_node INTEGER,

target_node INTEGER,

relationship TEXT,

relationship_data JSONB,

strength NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_graph_edges_source
ON food_brain_graph_edges(source_node);



CREATE TABLE IF NOT EXISTS food_brain_events
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

event_type TEXT,

event_data JSONB,

impact NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_brain_events_asset
ON food_brain_events(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_economic_patterns
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

pattern_type TEXT,

pattern_data JSONB,

success_score NUMERIC DEFAULT 0,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_economic_patterns_asset
ON food_brain_economic_patterns(asset_id);



ALTER TABLE food_brain_agent_messages

ADD COLUMN IF NOT EXISTS asset_id INTEGER,

ADD COLUMN IF NOT EXISTS from_agent TEXT,

ADD COLUMN IF NOT EXISTS to_agent TEXT,

ADD COLUMN IF NOT EXISTS message JSONB,

ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



CREATE INDEX IF NOT EXISTS idx_agent_message_asset
ON food_brain_agent_messages(asset_id);



SQL



echo "=== Creating graph intelligence engines ==="



mkdir -p services/assets/src/graph



cat > services/assets/src/graph/graphNodeEngine.js <<'JS'

const {pool}=require("../postgres");


async function createNode(data){

const result =
await pool.query(
`
INSERT INTO food_brain_graph_nodes
(
asset_id,
node_type,
node_name,
node_data,
importance
)

VALUES($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.type,
data.name,
JSON.stringify(data.data),
data.importance
]
);


return result.rows[0];

}


module.exports={
createNode
};

JS



cat > services/assets/src/graph/graphRelationshipEngine.js <<'JS'

const {pool}=require("../postgres");


async function connect(data){

const result =
await pool.query(
`
INSERT INTO food_brain_graph_edges
(
source_node,
target_node,
relationship,
relationship_data,
strength
)

VALUES($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.source,
data.target,
data.relationship,
JSON.stringify(data.data),
data.strength
]
);


return result.rows[0];

}


module.exports={
connect
};

JS



cat > services/assets/src/graph/eventMemoryEngine.js <<'JS'

const {pool}=require("../postgres");


async function record(data){

const result =
await pool.query(
`
INSERT INTO food_brain_events
(
asset_id,
event_type,
event_data,
impact
)

VALUES($1,$2,$3,$4)

RETURNING *
`,
[
data.assetId,
data.type,
JSON.stringify(data.data),
data.impact
]
);


return result.rows[0];

}


module.exports={
record
};

JS



cat > services/assets/src/graph/economicPatternEngine.js <<'JS'


function analyze(events){

let score=50;


if(events.includes("DEMAND_SPIKE"))
score+=25;


if(events.includes("FRESHNESS_DROP"))
score+=15;


if(score>100)
score=100;


return {

pattern:"FOOD_VALUE_MOVEMENT",

confidence:score

};

}



module.exports={
analyze
};

JS



cat > services/assets/src/graph/economyGraphBrainEngine.js <<'JS'

const node =
require("./graphNodeEngine");

const event =
require("./eventMemoryEngine");

const pattern =
require("./economicPatternEngine");



async function build(assetId,data){


const assetNode =
await node.createNode({

assetId,

type:"FOOD_ASSET",

name:data.name || "UNKNOWN",

data,

importance:90

});



const storedEvent =
await event.record({

assetId,

type:data.event || "MARKET_UPDATE",

data,

impact:data.impact || 50

});



const insight =
pattern.analyze(
[
data.event
]
);



return {

asset_id:assetId,

graph_node:assetNode,

event:storedEvent,

economic_pattern:insight

};


}



module.exports={
build
};

JS



echo "=== Creating graph route ==="


cat > services/assets/src/routes/brainGraphRoutes.js <<'JS'

const express=require("express");

const router=express.Router();


const graph =
require("../graph/economyGraphBrainEngine");



router.post(
"/graph/build/:assetId",
async(req,res)=>{

try{

res.json(
await graph.build(
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



echo "=== Register graph routes ==="



python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainGraphRoutes" not in text:

 text=text.replace(
 'const brainAgentRoutes = require("./routes/brainAgentRoutes");',
 '''const brainAgentRoutes = require("./routes/brainAgentRoutes");

const brainGraphRoutes = require("./routes/brainGraphRoutes");'''
 )


if 'app.use("/brain", brainGraphRoutes);' not in text:

 text=text.replace(
 'app.use("/brain", brainAgentRoutes);',
 '''app.use("/brain", brainAgentRoutes);

app.use("/brain", brainGraphRoutes);'''
 )


p.write_text(text)

PY



echo "=== Testing Layer 25 modules ==="


node - <<'NODE'

require("./services/assets/src/graph/graphNodeEngine");

require("./services/assets/src/graph/graphRelationshipEngine");

require("./services/assets/src/graph/eventMemoryEngine");

require("./services/assets/src/graph/economicPatternEngine");

require("./services/assets/src/graph/economyGraphBrainEngine");


console.log(
"Layer 25 economy graph intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 25 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test graph intelligence"
echo "3. commit + tag"

