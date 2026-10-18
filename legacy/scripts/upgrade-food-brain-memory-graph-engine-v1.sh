#!/bin/bash
set -e

echo "=== āprən Food Brain Memory Graph Engine v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-memory-graph-v1

cp -r services/assets/src \
backups/food-brain-memory-graph-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating memory graph modules ==="

mkdir -p services/assets/src/memoryGraph



cat > services/assets/src/memoryGraph/foodGraphEngine.js <<'JS'
const {pool}=require("../postgres");


async function createNode(data){

const result =
await pool.query(
`
INSERT INTO food_brain_memory_nodes
(
asset_id,
node_type,
node_name,
metadata
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.asset_id || null,
data.node_type,
data.node_name,
JSON.stringify(data.metadata || {})
]
);


return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory_nodes
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
createNode,
history
};
JS





cat > services/assets/src/memoryGraph/relationshipEngine.js <<'JS'
const {pool}=require("../postgres");


async function connect(data){

const result =
await pool.query(
`
INSERT INTO food_brain_memory_relationships
(
from_node,
to_node,
relationship,
strength
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.from_node,
data.to_node,
data.relationship,
data.strength || 50
]
);


return result.rows[0];

}



async function graph(node){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory_relationships
WHERE from_node=$1
OR to_node=$1
ORDER BY id DESC
`,
[
node
]
);


return result.rows;

}



module.exports={
connect,
graph
};
JS





cat > services/assets/src/memoryGraph/knowledgeQueryEngine.js <<'JS'
const {pool}=require("../postgres");


async function search(assetId,type){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory_nodes
WHERE asset_id=$1
AND node_type=$2
ORDER BY id DESC
`,
[
assetId,
type
]
);


return result.rows;

}



module.exports={
search
};
JS





cat > services/assets/src/memoryGraph/memoryGraphEngine.js <<'JS'
const graph =
require("./foodGraphEngine");

const relationship =
require("./relationshipEngine");

const query =
require("./knowledgeQueryEngine");


module.exports={
createNode:graph.createNode,
history:graph.history,
connect:relationship.connect,
graph:relationship.graph,
search:query.search
};

JS





echo "=== Creating memory graph tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_memory_nodes
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

node_type TEXT,

node_name TEXT,

metadata JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_memory_nodes_asset
ON food_brain_memory_nodes(asset_id);




CREATE TABLE IF NOT EXISTS food_brain_memory_relationships
(
id SERIAL PRIMARY KEY,

from_node INTEGER REFERENCES food_brain_memory_nodes(id)
ON DELETE CASCADE,

to_node INTEGER REFERENCES food_brain_memory_nodes(id)
ON DELETE CASCADE,

relationship TEXT,

strength NUMERIC,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_memory_relationship_from
ON food_brain_memory_relationships(from_node);



CREATE INDEX IF NOT EXISTS idx_memory_relationship_to
ON food_brain_memory_relationships(to_node);



SQL





echo "=== Adding memory routes ==="


python3 <<'PY'

from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "memoryGraphEngine" not in text:

    text=text.replace(
    'const perceptionEngine',
    '''const memoryGraphEngine = require("./memoryGraph/memoryGraphEngine");

const perceptionEngine'''
    )



routes="""


app.post("/brain/memory/node", async(req,res)=>{

try{

res.json(
await memoryGraphEngine.createNode(
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



app.post("/brain/memory/connect", async(req,res)=>{

try{

res.json(
await memoryGraphEngine.connect(
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



app.get("/brain/memory/graph/:nodeId", async(req,res)=>{

try{

res.json(
await memoryGraphEngine.graph(
req.params.nodeId
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/memory/:assetId/:type", async(req,res)=>{

try{

res.json(
await memoryGraphEngine.search(
req.params.assetId,
req.params.type
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


if "/brain/memory/node" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]



path.write_text(text)

PY




echo "=== Testing modules ==="


node - <<'NODE'

require("./services/assets/src/memoryGraph/foodGraphEngine");

require("./services/assets/src/memoryGraph/relationshipEngine");

require("./services/assets/src/memoryGraph/knowledgeQueryEngine");

require("./services/assets/src/memoryGraph/memoryGraphEngine");

console.log(
"Food brain memory graph loaded"
);

NODE



node --check services/assets/src/server.js



echo "=== COMPLETE ==="

echo "Next:"
echo "1. restart assets service"
echo "2. test memory node"
echo "3. git commit + tag"

