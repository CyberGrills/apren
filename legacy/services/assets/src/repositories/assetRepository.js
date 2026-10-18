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
