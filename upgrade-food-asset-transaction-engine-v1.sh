#!/bin/bash
set -e

echo "=== āprən Food Asset Transaction Engine v1 ==="

cd ~/apren

echo "=== Backup assets service ==="

mkdir -p backups/assets-transaction-engine

cp -r services/assets/src \
backups/assets-transaction-engine/src-$(date +%Y%m%d_%H%M%S)


echo "=== Creating repository layer ==="

mkdir -p services/assets/src/repositories


cat > services/assets/src/repositories/assetRepository.js <<'JS'
const postgres = require("../postgres");


async function createAsset(data){

const rows = await postgres.query(
`
INSERT INTO food_assets
(
food_id,
asset_code,
current_value,
freshness_score,
demand_score,
trust_score,
market_status,
available_supply,
kitchen_price
)
VALUES
($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8)
RETURNING *
`,
[
data.food_id || null,
data.asset_code,
data.current_value || 0,
data.freshness_score || 100,
data.demand_score || 0,
data.trust_score || 50,
data.available_supply || 0,
data.kitchen_price || 0
]
);

return rows[0];

}


async function getAsset(id){

const rows = await postgres.query(
`
SELECT *
FROM food_assets
WHERE id=$1
`,
[id]
);

return rows[0];

}


async function updateValue(id,value){

return postgres.query(
`
UPDATE food_assets
SET current_value=$1
WHERE id=$2
RETURNING *
`,
[value,id]
);

}


module.exports={
createAsset,
getAsset,
updateValue
};
JS



echo "=== Creating valuation engine ==="


cat > services/assets/src/intelligence/valuation.js <<'JS'

function calculateValue({

basePrice=10,
freshness=100,
demand=0,
trust=50,
scarcity=1

}){


const freshnessFactor =
freshness / 100;


const demandFactor =
1 + (demand / 100);


const trustFactor =
1 + ((trust-50)/100);


return Number(
(
basePrice *
freshnessFactor *
demandFactor *
trustFactor *
scarcity
)
.toFixed(2)
);

}


module.exports={
calculateValue
};

JS



echo "=== Creating PostgreSQL lifecycle tables ==="


docker exec apren-postgres psql \
-U apren \
-d apren <<'SQL'

CREATE TABLE IF NOT EXISTS food_asset_events
(
id SERIAL PRIMARY KEY,
asset_id INTEGER REFERENCES food_assets(id),
event_type TEXT NOT NULL,
description TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS food_asset_valuations
(
id SERIAL PRIMARY KEY,
asset_id INTEGER REFERENCES food_assets(id),
value NUMERIC(10,2),
freshness_score INTEGER,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS food_asset_ownership_history
(
id SERIAL PRIMARY KEY,
asset_id INTEGER REFERENCES food_assets(id),
owner_id INTEGER,
action TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS asset_transactions
(
id SERIAL PRIMARY KEY,
asset_id INTEGER REFERENCES food_assets(id),
seller_id INTEGER,
buyer_id INTEGER,
quantity NUMERIC(10,2),
price NUMERIC(10,2),
currency TEXT DEFAULT 'EUR',
status TEXT DEFAULT 'PENDING',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SQL



echo "=== Adding assets creation route helper ==="


cat > services/assets/src/assetTransactionEngine.js <<'JS'

const repository =
require("./repositories/assetRepository");

const valuation =
require("./intelligence/valuation");


async function createFoodAsset(data){


const value =
valuation.calculateValue({

basePrice:data.basePrice || 10,
freshness:data.freshness || 100,
demand:data.demand || 0,
trust:data.trust || 50

});


return repository.createAsset({

asset_code:data.asset_code,
current_value:value,
freshness_score:data.freshness || 100,
demand_score:data.demand || 0,
trust_score:data.trust || 50,
available_supply:data.quantity || 0

});


}


module.exports={
createFoodAsset
};

JS



echo "=== Testing modules ==="


node - <<'NODE'
require("./services/assets/src/postgres");
require("./services/assets/src/intelligence/valuation");
require("./services/assets/src/repositories/assetRepository");
console.log("Food Asset Transaction Engine modules loaded");
NODE


echo
echo "=== COMPLETE ==="
echo "Next: connect API routes and wallet settlement"
