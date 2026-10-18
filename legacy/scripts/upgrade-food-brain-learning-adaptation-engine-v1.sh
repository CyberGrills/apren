#!/bin/bash
set -e

echo "=== āprən Food Brain Learning & Adaptation Engine v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-learning-v1

cp -r services/assets/src \
backups/food-brain-learning-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating learning modules ==="

mkdir -p services/assets/src/learning



cat > services/assets/src/learning/feedbackEngine.js <<'JS'
const {pool}=require("../postgres");


async function record(data){

const result =
await pool.query(
`
INSERT INTO food_brain_learning_feedback
(
asset_id,
engine,
prediction,
actual_result,
accuracy,
error_score
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.asset_id,
data.engine,
JSON.stringify(data.prediction || {}),
JSON.stringify(data.actual_result || {}),
data.accuracy || 0,
data.error_score || 0
]
);


return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_learning_feedback
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
record,
history
};
JS





cat > services/assets/src/learning/performanceEngine.js <<'JS'
const {pool}=require("../postgres");


async function evaluate(engine){


const result =
await pool.query(
`
SELECT
AVG(accuracy) as accuracy,
COUNT(*) as samples
FROM food_brain_learning_feedback
WHERE engine=$1
`,
[
engine
]
);



return {

engine,

accuracy:
Number(
result.rows[0].accuracy || 0
),

samples:
Number(
result.rows[0].samples || 0
)

};

}



module.exports={
evaluate
};
JS





cat > services/assets/src/learning/adaptationEngine.js <<'JS'
const {pool}=require("../postgres");


async function adapt(engine){


const performance =
await pool.query(
`
SELECT
AVG(error_score) as error
FROM food_brain_learning_feedback
WHERE engine=$1
`,
[
engine
]
);



const error =
Number(
performance.rows[0].error || 0
);



let adjustment="NO_CHANGE";


if(error>20){

adjustment="INCREASE_REVIEW";

}
else if(error<5){

adjustment="HIGH_CONFIDENCE";

}



return {

engine,

error,

adjustment

};

}



module.exports={
adapt
};
JS





cat > services/assets/src/learning/learningEngine.js <<'JS'
const feedback =
require("./feedbackEngine");

const performance =
require("./performanceEngine");

const adaptation =
require("./adaptationEngine");


module.exports={

recordFeedback:
feedback.record,

history:
feedback.history,

performance:
performance.evaluate,

adapt:
adaptation.adapt

};
JS





echo "=== Creating learning database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_learning_feedback
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

engine TEXT,

prediction JSONB,

actual_result JSONB,

accuracy NUMERIC(5,2),

error_score NUMERIC(5,2),

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_learning_asset
ON food_brain_learning_feedback(asset_id);



CREATE INDEX IF NOT EXISTS idx_learning_engine
ON food_brain_learning_feedback(engine);


SQL





echo "=== Adding learning routes ==="


python3 <<'PY'

from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "learningEngine" not in text:

    text=text.replace(
    'const predictionEngine',
    '''const learningEngine = require("./learning/learningEngine");

const predictionEngine'''
    )



routes="""


app.post("/brain/learning/feedback", async(req,res)=>{

try{

res.json(
await learningEngine.recordFeedback(
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



app.get("/brain/learning/history/:assetId", async(req,res)=>{

try{

res.json(
await learningEngine.history(
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



app.get("/brain/learning/performance/:engine", async(req,res)=>{

try{

res.json(
await learningEngine.performance(
req.params.engine
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



app.get("/brain/learning/adapt/:engine", async(req,res)=>{

try{

res.json(
await learningEngine.adapt(
req.params.engine
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


if "/brain/learning/feedback" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY





echo "=== Testing learning modules ==="


node - <<'NODE'

require("./services/assets/src/learning/feedbackEngine");

require("./services/assets/src/learning/performanceEngine");

require("./services/assets/src/learning/adaptationEngine");

require("./services/assets/src/learning/learningEngine");

console.log(
"Food brain learning engine loaded"
);

NODE



node --check services/assets/src/server.js


echo "=== COMPLETE ==="

echo "Next:"
echo "1. restart assets service"
echo "2. test learning feedback"
echo "3. git commit + tag"

