#!/bin/bash
set -e

echo "=== āprən Food Brain Self Optimization Engine v1 ==="

cd ~/apren

echo "=== Backup ==="

mkdir -p backups/food-brain-self-optimization-v1

cp -r services/assets/src \
backups/food-brain-self-optimization-v1/src-$(date +%Y%m%d_%H%M%S)


echo "=== Creating optimization modules ==="

mkdir -p services/assets/src/optimization


cat > services/assets/src/optimization/optimizationEngine.js <<'JS'
const { pool } = require("../postgres");


async function optimize(assetId){

const feedback =
await pool.query(
`
SELECT
COUNT(*) total,
SUM(
CASE
WHEN success=true
THEN 1
ELSE 0
END
) success
FROM food_brain_feedback
WHERE asset_id=$1
`,
[assetId]
);


const row=feedback.rows[0];


const total=Number(row.total||0);
const success=Number(row.success||0);


const score =
total===0
?
50
:
Math.round((success/total)*100);


let strategy="STANDARD";


if(score>=85){

strategy="AGGRESSIVE_OPTIMIZATION";

}
else if(score<50 && total>3){

strategy="CONSERVATIVE_OPTIMIZATION";

}


const result=
await pool.query(
`
INSERT INTO food_brain_strategy_scores
(
asset_id,
strategy,
score,
sample_size
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
strategy,
score,
total
]
);


return {

asset_id:assetId,

strategy,

optimization_score:score,

sample_size:total,

record:result.rows[0]

};

}



async function history(assetId){

const result=
await pool.query(
`
SELECT *
FROM food_brain_strategy_scores
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);


return result.rows;

}


module.exports={
optimize,
history
};
JS



cat > services/assets/src/optimization/ruleEvolutionEngine.js <<'JS'
const { pool } = require("../postgres");


async function evolve(assetId){

const strategies =
await pool.query(
`
SELECT *
FROM food_brain_strategy_scores
WHERE asset_id=$1
ORDER BY score DESC
LIMIT 5
`,
[assetId]
);


let best="NONE";

let confidence=0;


if(strategies.rows.length){

best=strategies.rows[0].strategy;

confidence=
Number(strategies.rows[0].score);

}


const result=
await pool.query(
`
INSERT INTO food_brain_rule_evolution
(
asset_id,
best_strategy,
confidence
)

VALUES
($1,$2,$3)

RETURNING *
`,
[
assetId,
best,
confidence
]
);


return {

asset_id:assetId,

best_strategy:best,

confidence,

record:result.rows[0]

};

}



async function history(assetId){

const result=
await pool.query(
`
SELECT *
FROM food_brain_rule_evolution
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);

return result.rows;

}


module.exports={
evolve,
history
};
JS



echo "=== Creating optimization tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_strategy_scores
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

strategy TEXT,

score NUMERIC(5,2),

sample_size INTEGER,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_strategy_asset
ON food_brain_strategy_scores(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_rule_evolution
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

best_strategy TEXT,

confidence NUMERIC(5,2),

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_evolution_asset
ON food_brain_rule_evolution(asset_id);


SQL



echo "=== Adding optimization routes ==="


python3 <<'PY'
from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "optimizationEngine" not in text:

    text=text.replace(
    'const actionEngine',
    '''const optimizationEngine = require("./optimization/optimizationEngine");
const ruleEvolutionEngine = require("./optimization/ruleEvolutionEngine");

const actionEngine'''
    )


routes="""

app.post("/brain/optimize/:assetId", async(req,res)=>{

try{

res.json(
await optimizationEngine.optimize(
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


app.get("/brain/strategy/:assetId", async(req,res)=>{

try{

res.json(
await optimizationEngine.history(
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


app.post("/brain/evolve/:assetId", async(req,res)=>{

try{

res.json(
await ruleEvolutionEngine.evolve(
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


app.get("/brain/evolution/:assetId", async(req,res)=>{

try{

res.json(
await ruleEvolutionEngine.history(
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


if "/brain/optimize/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY



echo "=== Testing modules ==="


node - <<'NODE'

require("./services/assets/src/optimization/optimizationEngine");

require("./services/assets/src/optimization/ruleEvolutionEngine");

console.log(
"Food brain self optimization modules loaded"
);

NODE


echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test optimize"

