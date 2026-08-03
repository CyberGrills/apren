#!/bin/bash
set -e

echo "=== āprən Food Brain Adaptive Intelligence Layer 9 ==="

cd ~/apren

mkdir -p backups/layer9-adaptive-intelligence

cp -r services/assets/src \
backups/layer9-adaptive-intelligence/src-$(date +%Y%m%d_%H%M%S)


mkdir -p services/assets/src/adaptive


cat > services/assets/src/adaptive/adaptiveLearningEngine.js <<'JS'
const {pool}=require("../postgres");


async function evaluate(assetId){

const result = await pool.query(
`
SELECT *
FROM food_brain_learning_feedback
WHERE asset_id=$1
ORDER BY created_at DESC
LIMIT 50
`,
[assetId]
);


let accuracy=0;
let samples=result.rows.length;


if(samples){

let total=0;

for(const row of result.rows){

total += Number(row.accuracy || 0);

}

accuracy = Math.round(total / samples);

}


let adaptation="STABLE";


if(accuracy < 60){

adaptation="IMPROVE_MODEL";

}
else if(accuracy > 90){

adaptation="HIGH_CONFIDENCE";

}


return {

asset_id:assetId,

samples,

accuracy,

adaptation

};

}



module.exports={
evaluate
};
JS



cat > services/assets/src/adaptive/confidenceAdjustmentEngine.js <<'JS'

function adjust(data){

let confidence=50;


if(data.accuracy >= 90){

confidence=90;

}
else if(data.accuracy >= 70){

confidence=70;

}
else if(data.accuracy < 50){

confidence=40;

}


return {

confidence,

status:
confidence >=70
?"TRUSTED"
:"REVIEW"

};

}


module.exports={
adjust
};

JS



cat > services/assets/src/adaptive/adaptiveIntelligenceEngine.js <<'JS'

const learning =
require("./adaptiveLearningEngine");

const confidence =
require("./confidenceAdjustmentEngine");


async function adapt(assetId){

const learningState =
await learning.evaluate(assetId);


const confidenceState =
confidence.adjust(
learningState
);


return {

asset_id:assetId,

learning:learningState,

confidence:confidenceState

};

}


module.exports={
adapt
};

JS



python3 <<'PY'
from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()

if "adaptiveIntelligenceEngine" not in text:

    text=text.replace(
    'const memoryFusionEngine',
    '''const adaptiveIntelligenceEngine = require("./adaptive/adaptiveIntelligenceEngine");

const memoryFusionEngine'''
    )


route="""

app.get("/brain/adaptive/:assetId", async(req,res)=>{

try{

res.json(
await adaptiveIntelligenceEngine.adapt(
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


if "/brain/adaptive/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+route+text[insert:]


path.write_text(text)

PY



node - <<'NODE'

require("./services/assets/src/adaptive/adaptiveLearningEngine");
require("./services/assets/src/adaptive/confidenceAdjustmentEngine");
require("./services/assets/src/adaptive/adaptiveIntelligenceEngine");

console.log("Layer 9 adaptive intelligence loaded");

NODE


node --check services/assets/src/server.js


echo "=== LAYER 9 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test /brain/adaptive/:assetId"
echo "3. commit + tag"

