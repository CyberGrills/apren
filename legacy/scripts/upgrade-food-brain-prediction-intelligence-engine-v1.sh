#!/bin/bash
set -e

echo "=== āprən Food Brain Prediction Intelligence Engine v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-prediction-v1

cp -r services/assets/src \
backups/food-brain-prediction-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating prediction modules ==="

mkdir -p services/assets/src/prediction



cat > services/assets/src/prediction/freshnessPredictionEngine.js <<'JS'
function predict(data){

const current =
Number(data.freshness || 0);


const hours =
Number(data.hours || 24);


const decay =
Math.round(
(hours / 24) * 40
);


const future =
Math.max(
0,
current - decay
);


return {

current_freshness:current,

predicted_freshness:future,

hours_ahead:hours

};

}


module.exports={
predict
};
JS




cat > services/assets/src/prediction/demandPredictionEngine.js <<'JS'
function predict(data){

const demand =
Number(data.demand || 0);


const trend =
Number(data.trend || 0);



let future =
Math.round(
demand + trend
);



future=Math.min(
100,
Math.max(
0,
future
)
);



return {

current_demand:demand,

predicted_demand:future

};

}


module.exports={
predict
};
JS





cat > services/assets/src/prediction/valuePredictionEngine.js <<'JS'
function predict(data){

const value =
Number(data.value || 0);


const freshness =
Number(data.freshness || 0);



const multiplier =
0.5 + freshness / 200;



const futureValue =
Number(
(value * multiplier)
.toFixed(2)
);



return {

current_value:value,

predicted_value:futureValue

};

}



module.exports={
predict
};
JS





cat > services/assets/src/prediction/futureStateEngine.js <<'JS'
const freshness =
require("./freshnessPredictionEngine");


const demand =
require("./demandPredictionEngine");


const value =
require("./valuePredictionEngine");



function calculate(data){


const fresh =
freshness.predict(data);


const market =
demand.predict(data);


const price =
value.predict({

value:data.value,

freshness:
fresh.predicted_freshness

});



let recommendation="HOLD";


if(
fresh.predicted_freshness < 30 &&
market.predicted_demand > 70
){

recommendation="FAST_MOVE";

}

else if(
market.predicted_demand > 80
){

recommendation="PROMOTE";

}



return {

freshness:fresh,

demand:market,

value:price,

recommendation

};

}



module.exports={
calculate
};
JS





cat > services/assets/src/prediction/predictionEngine.js <<'JS'
const {pool}=require("../postgres");


const future =
require("./futureStateEngine");



async function predict(assetId,data){


const prediction =
future.calculate(data);



const result =
await pool.query(
`
INSERT INTO food_brain_predictions
(
asset_id,
prediction,
recommendation
)

VALUES
($1,$2,$3)

RETURNING *
`,
[
assetId,
JSON.stringify(prediction),
prediction.recommendation
]
);



return {

asset_id:assetId,

prediction,

record:result.rows[0]

};

}





async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_predictions
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
predict,
history
};

JS





echo "=== Creating prediction tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_predictions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

prediction JSONB,

recommendation TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_predictions_asset
ON food_brain_predictions(asset_id);



SQL





echo "=== Adding prediction routes ==="


python3 <<'PY'

from pathlib import Path


path=Path("services/assets/src/server.js")


text=path.read_text()



if "predictionEngine" not in text:

    text=text.replace(
    'const memoryGraphEngine',
    '''const predictionEngine = require("./prediction/predictionEngine");

const memoryGraphEngine'''
    )



routes="""


app.post("/brain/predict/:assetId", async(req,res)=>{

try{

res.json(
await predictionEngine.predict(
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



app.get("/brain/predict/history/:assetId", async(req,res)=>{

try{

res.json(
await predictionEngine.history(
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



if "/brain/predict/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]



path.write_text(text)

PY





echo "=== Testing prediction modules ==="


node - <<'NODE'

require("./services/assets/src/prediction/freshnessPredictionEngine");

require("./services/assets/src/prediction/demandPredictionEngine");

require("./services/assets/src/prediction/valuePredictionEngine");

require("./services/assets/src/prediction/futureStateEngine");

require("./services/assets/src/prediction/predictionEngine");


console.log(
"Food brain prediction intelligence loaded"
);

NODE



node --check services/assets/src/server.js



echo "=== COMPLETE ==="

echo "Next:"
echo "1. restart assets service"
echo "2. test prediction"
echo "3. git commit + tag"


