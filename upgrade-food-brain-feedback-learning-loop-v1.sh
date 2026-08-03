#!/bin/bash
set -e

echo "=== āprən Food Brain Feedback Learning Loop v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/food-brain-feedback-v1

cp -r services/assets/src \
backups/food-brain-feedback-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating feedback modules ==="

mkdir -p services/assets/src/learning



cat > services/assets/src/learning/feedbackEngine.js <<'JS'
const { pool } = require("../postgres");


async function recordFeedback(data){

const result =
await pool.query(
`
INSERT INTO food_brain_feedback
(
prediction_id,
asset_id,
result,
success,
impact
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.prediction_id,
data.asset_id,
data.result,
data.success,
data.impact || null
]
);



await pool.query(
`
UPDATE food_predictions
SET resolved=true
WHERE id=$1
`,
[
data.prediction_id
]
);



return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_feedback
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
recordFeedback,
history
};
JS





cat > services/assets/src/learning/accuracyEngine.js <<'JS'
const { pool } = require("../postgres");


async function calculate(assetId){


const result =
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
) successful
FROM food_brain_feedback
WHERE asset_id=$1
`,
[
assetId
]
);



const row =
result.rows[0];


const total =
Number(row.total || 0);


const successful =
Number(row.successful || 0);



const accuracy =
total===0
?
0
:
Math.round(
(successful / total) * 100
);



await pool.query(
`
INSERT INTO food_brain_accuracy
(
asset_id,
accuracy_score,
sample_size
)

VALUES
($1,$2,$3)
`,
[
assetId,
accuracy,
total
]
);



return {

asset_id:assetId,

accuracy_score:accuracy,

sample_size:total

};


}



module.exports={
calculate
};
JS





cat > services/assets/src/learning/adaptationEngine.js <<'JS'
const accuracy =
require("./accuracyEngine");


async function adapt(assetId){


const result =
await accuracy.calculate(assetId);



let mode="STANDARD";


if(
result.accuracy_score >=80
){

mode="HIGH_CONFIDENCE";

}

else if(
result.accuracy_score <50 &&
result.sample_size>3
){

mode="CAUTIOUS";

}



return {

asset_id:assetId,

brain_mode:mode,

accuracy:result.accuracy_score,

sample_size:result.sample_size

};


}



module.exports={
adapt
};
JS





echo "=== Creating learning tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_feedback
(
id SERIAL PRIMARY KEY,

prediction_id INTEGER REFERENCES food_predictions(id)
ON DELETE CASCADE,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

result TEXT,

success BOOLEAN,

impact TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_brain_feedback_asset
ON food_brain_feedback(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_accuracy
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

accuracy_score NUMERIC(5,2),

sample_size INTEGER,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_brain_accuracy_asset
ON food_brain_accuracy(asset_id);



SQL





echo "=== Adding feedback routes ==="


python3 <<'PY'

from pathlib import Path

path=Path(
"services/assets/src/server.js"
)

text=path.read_text()



if "feedbackEngine" not in text:

    text=text.replace(
    'const brainMemoryEngine',
    'const feedbackEngine = require("./learning/feedbackEngine");\nconst accuracyEngine = require("./learning/accuracyEngine");\nconst adaptationEngine = require("./learning/adaptationEngine");\n\nconst brainMemoryEngine'
    )



routes="""


app.post("/brain/feedback/store", async(req,res)=>{

try{

res.json(
await feedbackEngine.recordFeedback(
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



app.get("/brain/feedback/:assetId", async(req,res)=>{

try{

res.json(
await feedbackEngine.history(
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



app.get("/brain/accuracy/:assetId", async(req,res)=>{

try{

res.json(
await accuracyEngine.calculate(
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



app.get("/brain/adapt/:assetId", async(req,res)=>{

try{

res.json(
await adaptationEngine.adapt(
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


if "/brain/feedback/store" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]



path.write_text(text)

PY





echo "=== Testing learning modules ==="


node - <<'NODE'

require("./services/assets/src/learning/feedbackEngine");

require("./services/assets/src/learning/accuracyEngine");

require("./services/assets/src/learning/adaptationEngine");

console.log(
"Food brain feedback learning modules loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. submit feedback"
echo "4. check adaptation"

