const { pool } = require("../postgres");


function determineState(freshness){

freshness = Number(freshness);


if(freshness >= 80){

return "ACTIVE";

}

if(freshness >= 40){

return "AGING";

}

if(freshness > 0){

return "EXPIRING";

}


return "EXPIRED";

}



async function updateLifecycle(data){

const state =
determineState(data.freshness);



const previous =
await pool.query(
`
SELECT state
FROM food_asset_lifecycle
WHERE asset_id=$1
ORDER BY id DESC
LIMIT 1
`,
[
data.asset_id
]
);



const previousState =
previous.rows[0]?.state || null;



const result =
await pool.query(
`
INSERT INTO food_asset_lifecycle
(
asset_id,
state,
previous_state,
freshness_score,
market_value,
reason
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.asset_id,
state,
previousState,
data.freshness,
data.market_value || 0,
data.reason || "Automatic lifecycle evaluation"
]
);



return result.rows[0];

}



async function getLifecycle(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_asset_lifecycle
WHERE asset_id=$1
ORDER BY id ASC
`,
[
assetId
]
);


return result.rows;

}



module.exports={
updateLifecycle,
getLifecycle,
determineState
};
