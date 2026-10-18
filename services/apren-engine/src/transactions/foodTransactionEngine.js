const { pool } = require("../postgres");

const valuation =
require("../intelligence/valuation");


async function createFoodEconomyTransaction(data){

const client = await pool.connect();


try {


await client.query("BEGIN");



const value =
valuation.calculateValue({

basePrice:data.basePrice || 10,

freshness:data.freshness || 100,

demand:data.demand || 0,

trust:data.trust || 50,

scarcity:data.scarcity || 1

});



const assetResult =
await client.query(
`
INSERT INTO food_assets
(
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
($1,$2,$3,$4,$5,'ACTIVE',$6,$7)

RETURNING *
`,
[
data.asset_code || `FOOD-${Date.now()}`,
value,
data.freshness || 100,
data.demand || 0,
data.trust || 50,
data.quantity || 0,
data.basePrice || value
]
);



const asset =
assetResult.rows[0];



if(data.owner_id){


await client.query(
`
INSERT INTO food_asset_holdings
(
user_id,
asset_id,
quantity,
average_price
)

VALUES
($1,$2,$3,$4)

ON CONFLICT(user_id,asset_id)

DO UPDATE SET

quantity =
food_asset_holdings.quantity
+
EXCLUDED.quantity

`,
[
data.owner_id,
asset.id,
data.quantity || 0,
value
]
);



await client.query(
`
INSERT INTO food_asset_ownership_history
(
asset_id,
owner_id,
action
)

VALUES
($1,$2,'CREATED')

`,
[
asset.id,
data.owner_id
]
);


}



await client.query(
`
INSERT INTO food_asset_events
(
asset_id,
event_type,
description
)

VALUES
($1,'CREATED',
'Atomic food transaction completed')

`,
[
asset.id
]
);



await client.query("COMMIT");


return asset;


}

catch(error){

await client.query("ROLLBACK");

throw error;

}

finally{

client.release();

}


}


module.exports={
createFoodEconomyTransaction
};
