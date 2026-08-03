#!/bin/bash
set -e

echo "=== āprən Food Brain Memory Fusion Engine v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-memory-fusion-v1

cp -r services/assets/src \
backups/food-brain-memory-fusion-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating memory modules ==="

mkdir -p services/assets/src/memory



cat > services/assets/src/memory/memoryCollector.js <<'JS'
const {pool}=require("../postgres");


async function collect(assetId){


const result =
await pool.query(
`
SELECT *
FROM (

SELECT
'prediction' AS source,
prediction AS data,
created_at
FROM food_brain_predictions
WHERE asset_id=$1


UNION ALL


SELECT
'learning' AS source,
jsonb_build_object(
'accuracy',accuracy,
'error_score',error_score,
'prediction',prediction,
'actual_result',actual_result
) AS data,
created_at
FROM food_brain_learning_feedback
WHERE asset_id=$1


UNION ALL


SELECT
'decision' AS source,
decision AS data,
created_at
FROM food_brain_decisions
WHERE asset_id=$1


UNION ALL


SELECT
'governor' AS source,
signals AS data,
created_at
FROM food_brain_governor_decisions
WHERE asset_id=$1

) memory

ORDER BY created_at DESC

`,
[
assetId
]
);


return result.rows;

}


module.exports={
collect
};
JS




cat > services/assets/src/memory/memoryGraphEngine.js <<'JS'
const {pool}=require("../postgres");


async function build(assetId,events){


const nodes=[];


for(const event of events){


const result =
await pool.query(
`
INSERT INTO food_brain_memory_nodes
(
asset_id,
memory_type,
content
)

VALUES
($1,$2,$3)

RETURNING *
`,
[
assetId,
event.source,
JSON.stringify(event.data)
]
);


nodes.push(result.rows[0]);

}



return nodes;

}



module.exports={
build
};
JS




cat > services/assets/src/memory/memoryRecallEngine.js <<'JS'
const {pool}=require("../postgres");


async function recall(assetId){


const result =
await pool.query(
`
SELECT *
FROM food_brain_memory_nodes
WHERE asset_id=$1
ORDER BY created_at DESC
LIMIT 100
`,
[
assetId
]
);


return result.rows;

}



module.exports={
recall
};
JS





cat > services/assets/src/memory/memoryFusionEngine.js <<'JS'
const collector =
require("./memoryCollector");


const graph =
require("./memoryGraphEngine");


const recall =
require("./memoryRecallEngine");



async function build(assetId){


const events =
await collector.collect(assetId);


const nodes =
await graph.build(
assetId,
events
);


return {

asset_id:assetId,

events_collected:
events.length,

memory_nodes_created:
nodes.length,

nodes

};

}




module.exports={

build,

recall:
recall.recall

};
JS





echo "=== Creating memory database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_memory_nodes
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

memory_type TEXT,

content JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_memory_asset
ON food_brain_memory_nodes(asset_id);



CREATE INDEX IF NOT EXISTS idx_memory_type
ON food_brain_memory_nodes(memory_type);



SQL





echo "=== Adding memory routes ==="


python3 <<'PY'

from pathlib import Path


path=Path("services/assets/src/server.js")


text=path.read_text()



if "memoryFusionEngine" not in text:

    text=text.replace(
    'const executiveGovernorEngine',
    '''const memoryFusionEngine = require("./memory/memoryFusionEngine");

const executiveGovernorEngine'''
    )



routes="""


app.post("/brain/memory/build/:assetId", async(req,res)=>{

try{

res.json(
await memoryFusionEngine.build(
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



app.get("/brain/memory/recall/:assetId", async(req,res)=>{

try{

res.json(
await memoryFusionEngine.recall(
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



if "/brain/memory/build/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]



path.write_text(text)

PY





echo "=== Testing memory modules ==="


node - <<'NODE'

require("./services/assets/src/memory/memoryCollector");

require("./services/assets/src/memory/memoryGraphEngine");

require("./services/assets/src/memory/memoryRecallEngine");

require("./services/assets/src/memory/memoryFusionEngine");


console.log(
"Food brain memory fusion loaded"
);

NODE



node --check services/assets/src/server.js



echo

echo "=== LAYER 8 COMPLETE ==="

echo "Next:"
echo "1. restart assets service"
echo "2. test memory build"
echo "3. git commit + tag"

