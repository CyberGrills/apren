#!/bin/bash
set -e

echo "=== āprən Food Intelligence Freshness Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/freshness-engine-v1

cp -r services/assets/src \
backups/freshness-engine-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating intelligence modules ==="

mkdir -p services/assets/src/intelligence



cat > services/assets/src/intelligence/freshnessEngine.js <<'JS'
function calculateFreshness(data){

const now = Date.now();

const uploaded =
new Date(data.uploaded_at).getTime();


const hoursPassed =
(now - uploaded) /
(1000 * 60 * 60);



let freshness;


if(data.perishable === false){

freshness = 100;

}
else{

freshness =
Math.max(
0,
100 - (hoursPassed / 24) * 100
);

}



let status;


if(freshness >= 80){

status="FRESH";

}
else if(freshness >= 40){

status="AGING";

}
else if(freshness > 0){

status="EXPIRING";

}
else{

status="EXPIRED";

}



return {

freshness_score:
Number(freshness.toFixed(2)),

status,

remaining_hours:
Math.max(
0,
24 - hoursPassed
)

};


}


module.exports={
calculateFreshness
};
JS



cat > services/assets/src/intelligence/foodEvidenceEngine.js <<'JS'
const freshness =
require("./freshnessEngine");


async function analyzeEvidence(data){


const result =
freshness.calculateFreshness(data);



return {

food_name:data.food_name,

image:data.image || null,

video:data.video || null,

freshness:result,

confidence:
data.confidence || 50


};


}


module.exports={
analyzeEvidence
};
JS



echo "=== Creating database tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_evidence
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

food_name TEXT,

image_url TEXT,

video_url TEXT,

confidence NUMERIC(5,2),

freshness_score NUMERIC(5,2),

freshness_status TEXT,

uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE IF NOT EXISTS freshness_history
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

freshness_score NUMERIC(5,2),

status TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_evidence_asset
ON food_evidence(asset_id);



CREATE INDEX IF NOT EXISTS idx_freshness_history_asset
ON freshness_history(asset_id);


SQL



echo "=== Adding intelligence routes ==="


python3 <<'PY'

from pathlib import Path


path=Path(
"services/assets/src/server.js"
)


text=path.read_text()


if "foodEvidenceEngine" not in text:

    text=text.replace(
    'const portfolioEngine',
    'const foodEvidenceEngine = require("./intelligence/foodEvidenceEngine");\n\nconst portfolioEngine'
    )


routes="""


app.post("/food/evidence/analyze", async(req,res)=>{

try{


const result =
await foodEvidenceEngine.analyzeEvidence(
req.body
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


if "/food/evidence/analyze" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY



echo "=== Testing modules ==="


node - <<'NODE'

require("./services/assets/src/intelligence/freshnessEngine");

require("./services/assets/src/intelligence/foodEvidenceEngine");

console.log(
"Food intelligence modules loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. test evidence analysis"

