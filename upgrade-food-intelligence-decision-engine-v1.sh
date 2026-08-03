#!/bin/bash
set -e

echo "=== āprən Food Intelligence Decision Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/decision-engine-v1

cp -r services/assets/src \
backups/decision-engine-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating intelligence modules ==="

mkdir -p services/assets/src/intelligence



cat > services/assets/src/intelligence/valuationEngine.js <<'JS'
function calculateValue(data){

const base =
Number(data.current_value || 0);


const freshness =
Number(data.freshness || 0) / 100;


const demand =
Number(data.demand || 0) / 100;


const trust =
Number(data.trust || 0) / 100;



const multiplier =
(
0.5 * freshness +
0.3 * demand +
0.2 * trust
);



return {

base_value:base,

valuation_multiplier:
Number(multiplier.toFixed(3)),

estimated_value:
Number(
(base * (1 + multiplier))
.toFixed(2)
)

};


}


module.exports={
calculateValue
};
JS





cat > services/assets/src/intelligence/decisionEngine.js <<'JS'
const { pool } = require("../postgres");

const rules =
require("../rules/ruleEngine");

const valuation =
require("./valuationEngine");


async function evaluateAsset(assetId){


const asset =
await pool.query(
`
SELECT *
FROM food_assets
WHERE id=$1
`,
[
assetId
]
);



if(!asset.rows[0]){

throw new Error("Asset not found");

}



const item =
asset.rows[0];



const context={

freshness:
item.freshness_score,

trust:
item.trust_score,

demand:
item.demand_score,

supply:
item.available_supply

};



const ruleResult =
await rules.evaluate(context);



const value =
valuation.calculateValue({

current_value:
item.current_value,

freshness:
item.freshness_score,

trust:
item.trust_score,

demand:
item.demand_score

});



let decision="TRADE_READY";


if(!ruleResult.allowed){

decision="BLOCKED";

}

else if(
ruleResult.warnings.length > 0
){

decision="REVIEW";

}



const result =
await pool.query(
`
INSERT INTO food_intelligence_decisions
(
asset_id,
decision,
valuation,
allowed,
warnings
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
assetId,
decision,
JSON.stringify(value),
ruleResult.allowed,
JSON.stringify(ruleResult.warnings)
]
);



return {

decision,

valuation:value,

rules:ruleResult,

record:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_intelligence_decisions
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
evaluateAsset,
history
};
JS




echo "=== Creating intelligence tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_intelligence_decisions
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

decision TEXT,

valuation JSONB,

allowed BOOLEAN,

warnings JSONB,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE INDEX IF NOT EXISTS idx_food_intelligence_asset
ON food_intelligence_decisions(asset_id);


SQL





echo "=== Adding intelligence API ==="


python3 <<'PY'

from pathlib import Path

path=Path(
"services/assets/src/server.js"
)

text=path.read_text()


if "decisionEngine" not in text:

    text=text.replace(
    'const lifecycleEngine',
    'const decisionEngine = require("./intelligence/decisionEngine");\n\nconst lifecycleEngine'
    )



routes="""


app.post("/food/intelligence/evaluate/:assetId", async(req,res)=>{

try{


const result =
await decisionEngine.evaluateAsset(
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



app.get("/food/intelligence/:assetId", async(req,res)=>{

try{


const result =
await decisionEngine.history(
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



if "/food/intelligence/evaluate/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY




echo "=== Testing modules ==="


node - <<'NODE'

require("./services/assets/src/intelligence/valuationEngine");

require("./services/assets/src/intelligence/decisionEngine");

console.log(
"Food intelligence decision modules loaded"
);

NODE



echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. evaluate asset"

