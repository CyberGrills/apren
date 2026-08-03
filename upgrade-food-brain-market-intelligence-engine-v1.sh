#!/bin/bash
set -e

echo "=== āprən Food Brain Market Intelligence Engine v1 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/food-brain-market-intelligence-v1

cp -r services/assets/src \
backups/food-brain-market-intelligence-v1/src-$(date +%Y%m%d_%H%M%S)



echo "=== Creating market intelligence modules ==="

mkdir -p services/assets/src/market



cat > services/assets/src/market/supplyIntelligenceEngine.js <<'JS'
const { pool } = require("../postgres");


function analyze(data){

const supply =
Number(data.supply || 0);

const demand =
Number(data.demand || 0);


let status="BALANCED";

let pressure=50;


if(supply <= 0){

status="OUT_OF_STOCK";
pressure=100;

}
else if(
supply < demand
){

status="SCARCITY";
pressure=80;

}
else if(
supply > demand * 3
){

status="OVERSUPPLY";
pressure=20;

}


return {

status,

supply,

demand,

supply_pressure:pressure

};

}



async function record(assetId,data){

const analysis =
analyze(data);


const result =
await pool.query(
`
INSERT INTO food_brain_supply_intelligence
(
asset_id,
status,
supply_amount,
demand_amount,
pressure
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
assetId,
analysis.status,
analysis.supply,
analysis.demand,
analysis.supply_pressure
]
);


return {

asset_id:assetId,

analysis,

record:result.rows[0]

};

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_supply_intelligence
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);

return result.rows;

}



module.exports={
analyze,
record,
history
};
JS





cat > services/assets/src/market/demandForecastEngine.js <<'JS'
const {pool}=require("../postgres");


async function forecast(assetId,data){


const current =
Number(data.current_demand || 0);


const growth =
Number(data.growth_rate || 0);



const predicted =
Math.min(
100,
Math.round(
current + (current * growth / 100)
)
);



let trend="STABLE";


if(predicted>current){

trend="RISING";

}
else if(predicted<current){

trend="DECLINING";

}



const result =
await pool.query(
`
INSERT INTO food_brain_demand_forecasts
(
asset_id,
current_demand,
predicted_demand,
trend
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
current,
predicted,
trend
]
);



return {

asset_id:assetId,

current_demand:current,

predicted_demand:predicted,

trend,

record:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_demand_forecasts
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);

return result.rows;

}



module.exports={
forecast,
history
};
JS





cat > services/assets/src/market/opportunityAgent.js <<'JS'
function analyze(data){


let opportunity="HOLD";

let reason="Market conditions stable";



if(
data.freshness < 30 &&
data.demand > 70
){

opportunity="FAST_SELL";

reason="High demand with freshness risk";

}

else if(
data.demand > 80 &&
data.freshness > 70
){

opportunity="PROMOTE";

reason="Strong demand and healthy freshness";

}

else if(
data.supply < data.demand
){

opportunity="INCREASE_SUPPLY";

reason="Demand exceeds available supply";

}



return {

opportunity,

reason

};

}



module.exports={
analyze
};
JS





cat > services/assets/src/market/marketIntelligenceEngine.js <<'JS'
const supply =
require("./supplyIntelligenceEngine");

const demand =
require("./demandForecastEngine");

const opportunity =
require("./opportunityAgent");


async function analyze(assetId,data){

const supplyResult =
supply.analyze(data);


const opportunityResult =
opportunity.analyze(data);


return {

asset_id:assetId,

supply:supplyResult,

opportunity:opportunityResult

};

}



module.exports={
analyze
};
JS





echo "=== Creating market tables ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_supply_intelligence
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

status TEXT,

supply_amount NUMERIC,

demand_amount NUMERIC,

pressure NUMERIC,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_supply_asset
ON food_brain_supply_intelligence(asset_id);



CREATE TABLE IF NOT EXISTS food_brain_demand_forecasts
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

current_demand NUMERIC,

predicted_demand NUMERIC,

trend TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_demand_forecast_asset
ON food_brain_demand_forecasts(asset_id);


SQL





echo "=== Adding market routes ==="


python3 <<'PY'

from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "supplyIntelligenceEngine" not in text:

    text=text.replace(
    'const valuationEngine',
    '''const supplyIntelligenceEngine = require("./market/supplyIntelligenceEngine");
const demandForecastEngine = require("./market/demandForecastEngine");
const marketIntelligenceEngine = require("./market/marketIntelligenceEngine");

const valuationEngine'''
    )



routes="""


app.post("/market/supply/:assetId", async(req,res)=>{

try{

res.json(
await supplyIntelligenceEngine.record(
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



app.post("/market/forecast/:assetId", async(req,res)=>{

try{

res.json(
await demandForecastEngine.forecast(
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



app.post("/market/intelligence/:assetId", async(req,res)=>{

try{

res.json(
await marketIntelligenceEngine.analyze(
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


"""


if "/market/supply/" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY





echo "=== Testing modules ==="


node - <<'NODE'

require("./services/assets/src/market/supplyIntelligenceEngine");

require("./services/assets/src/market/demandForecastEngine");

require("./services/assets/src/market/opportunityAgent");

require("./services/assets/src/market/marketIntelligenceEngine");

console.log("Food brain market intelligence loaded");

NODE



node --check services/assets/src/server.js


echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. restart assets service"
echo "2. test market intelligence"

