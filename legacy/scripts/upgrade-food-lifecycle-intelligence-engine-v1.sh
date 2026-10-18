#!/bin/bash
set -e

echo "=== āprən Food Lifecycle Intelligence Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/lifecycle-engine-v1

cp -r services/assets/src \
backups/lifecycle-engine-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating lifecycle engine ==="

mkdir -p services/assets/src/lifecycle



cat > services/assets/src/lifecycle/lifecycleEngine.js <<'JS'
const { pool } = require("../postgres");


function determineState(freshness){

freshness = Number(freshness);


if(freshness >= 80){

return "ACTIVE";

}

if(freshness >= 40){

return "AGING";

}

if(freshness > 0){

return "EXPIRING";

}


return "EXPIRED";

}



async function updateLifecycle(data){

const state =
determineState(data.freshness);



const previous =
await pool.query(
`
SELECT state
FROM food_asset_lifecycle
WHERE asset_id=$1
ORDER BY id DESC
LIMIT 1
`,
[
data.asset_id
]
);



const previousState =
previous.rows[0]?.state || null;



const result =
await pool.query(
`
INSERT INTO food_asset_lifecycle
(
asset_id,
state,
previous_state,
freshness_score,
market_value,
reason
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.asset_id,
state,
previousState,
data.freshness,
data.market_value || 0,
data.reason || "Automatic lifecycle evaluation"
]
);



return result.rows[0];

}



async function getLifecycle(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_asset_lifecycle
WHERE asset_id=$1
ORDER BY id ASC
`,
[
assetId
]
);


return result.rows;

}



module.exports={
updateLifecycle,
getLifecycle,
determineState
};
JS




echo "=== Creating lifecycle database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_asset_lifecycle
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

state TEXT NOT NULL,

previous_state TEXT,

freshness_score NUMERIC(5,2),

market_value NUMERIC(12,2),

reason TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_asset_lifecycle_asset
ON food_asset_lifecycle(asset_id);



SQL





echo "=== Adding lifecycle routes ==="


python3 <<'PY'

from pathlib import Path


path=Path(
"services/assets/src/server.js"
)


text=path.read_text()



if "lifecycleEngine" not in text:

    text=text.replace(
    'const ruleEngine',
    'const lifecycleEngine = require("./lifecycle/lifecycleEngine");\n\nconst ruleEngine'
    )



routes="""


app.post("/food/lifecycle/update", async(req,res)=>{

try{


const result =
await lifecycleEngine.updateLifecycle(
req.body
);


res.json({

success:true,

lifecycle:result

});


}

catch(error){

res.status(500).json({

error:error.message

});

}


});



app.get("/food/lifecycle/:assetId", async(req,res)=>{


try{


const result =
await lifecycleEngine.getLifecycle(
req.params.assetId
);


res.json(result);


}

catch(error){

res.status(500).json({

error:error.message

});

}


});



"""


if "/food/lifecycle/update" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]



path.write_text(text)

PY




echo "=== Testing lifecycle module ==="


node - <<'NODE'

require("./services/assets/src/lifecycle/lifecycleEngine");

console.log(
"Food lifecycle engine loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test lifecycle update"

