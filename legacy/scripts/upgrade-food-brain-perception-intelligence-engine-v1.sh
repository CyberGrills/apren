#!/bin/bash
set -e

echo "=== āprən Food Brain Food Perception Intelligence Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/food-brain-perception-v1

cp -r services/assets/src \
backups/food-brain-perception-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating perception modules ==="

mkdir -p services/assets/src/perception



cat > services/assets/src/perception/foodRecognitionEngine.js <<'JS'
function recognize(data){

let food="UNKNOWN";
let confidence=50;


const input =
String(data.food_hint || "")
.toLowerCase();


if(input){

food=input;
confidence=80;

}


return {

food,

confidence

};

}


module.exports={
recognize
};
JS





cat > services/assets/src/perception/freshnessVisionEngine.js <<'JS'
function analyze(data){

let freshness=70;

let confidence=60;



if(data.image_reference){

freshness+=10;
confidence+=10;

}


if(data.video_reference){

freshness+=10;
confidence+=10;

}



freshness=Math.min(
100,
freshness
);


confidence=Math.min(
100,
confidence
);



return {

freshness_score:freshness,

confidence

};

}


module.exports={
analyze
};
JS





cat > services/assets/src/perception/expiryPredictionEngine.js <<'JS'
function predict(freshness){

let hours=24;


if(freshness>=90){

hours=24;

}
else if(freshness>=70){

hours=12;

}
else if(freshness>=40){

hours=6;

}
else{

hours=1;

}


return {

expiry_hours:hours

};

}


module.exports={
predict
};
JS





cat > services/assets/src/perception/observationEngine.js <<'JS'
const {pool}=require("../postgres");


async function save(data){


const result =
await pool.query(
`
INSERT INTO food_brain_food_observations
(
asset_id,
image_reference,
video_reference,
detected_food,
freshness_score,
expiry_hours,
confidence
)

VALUES
($1,$2,$3,$4,$5,$6,$7)

RETURNING *
`,
[
data.asset_id || null,
data.image_reference || null,
data.video_reference || null,
data.detected_food,
data.freshness_score,
data.expiry_hours,
data.confidence
]
);


return result.rows[0];

}



async function history(assetId){


const result =
await pool.query(
`
SELECT *
FROM food_brain_food_observations
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
save,
history
};
JS





cat > services/assets/src/perception/perceptionEngine.js <<'JS'
const recognition =
require("./foodRecognitionEngine");

const freshness =
require("./freshnessVisionEngine");

const expiry =
require("./expiryPredictionEngine");

const observation =
require("./observationEngine");



async function analyze(data){


const food =
recognition.recognize(data);



const fresh =
freshness.analyze(data);



const exp =
expiry.predict(
fresh.freshness_score
);



const result =
await observation.save({

asset_id:data.asset_id,

image_reference:data.image_reference,

video_reference:data.video_reference,

detected_food:food.food,

freshness_score:fresh.freshness_score,

expiry_hours:exp.expiry_hours,

confidence:
Math.round(
(
food.confidence+
fresh.confidence
)
/2
)

});



return {

observation:result,

intelligence:{

food:food.food,

freshness_score:fresh.freshness_score,

expiry_hours:exp.expiry_hours,

confidence:result.confidence

}

};


}



module.exports={
analyze
};
JS





echo "=== Creating perception database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_food_observations
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

image_reference TEXT,

video_reference TEXT,

detected_food TEXT,

freshness_score NUMERIC(5,2),

expiry_hours NUMERIC(10,2),

confidence NUMERIC(5,2),

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_observation_asset
ON food_brain_food_observations(asset_id);


SQL





echo "=== Adding perception routes ==="


python3 <<'PY'

from pathlib import Path


path=Path(
"services/assets/src/server.js"
)


text=path.read_text()



if "perceptionEngine" not in text:

    text=text.replace(
    'const supplyIntelligenceEngine',
    '''const perceptionEngine = require("./perception/perceptionEngine");

const supplyIntelligenceEngine'''
    )



routes="""


app.post("/brain/perception/analyze", async(req,res)=>{

try{

res.json(
await perceptionEngine.analyze(
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



app.get("/brain/perception/history/:assetId", async(req,res)=>{

try{

const observation =
require("./perception/observationEngine");


res.json(
await observation.history(
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



if "/brain/perception/analyze" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]



path.write_text(text)

PY





echo "=== Testing perception modules ==="


node - <<'NODE'

require("./services/assets/src/perception/foodRecognitionEngine");

require("./services/assets/src/perception/freshnessVisionEngine");

require("./services/assets/src/perception/expiryPredictionEngine");

require("./services/assets/src/perception/perceptionEngine");

console.log(
"Food brain perception modules loaded"
);

NODE



node --check services/assets/src/server.js



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. ./restart-assets-clean-v1.sh"
echo "2. test perception endpoint"
echo "3. git commit + tag"


