const { pool } = require("../postgres");


function calculateValue(asset){

const base =
Number(asset.current_value || 0);


const freshness =
Number(asset.freshness_score || 0);


const demand =
Number(asset.demand_score || 0);


const trust =
Number(asset.trust_score || 0);



const freshnessMultiplier =
0.5 + (freshness / 200);


const demandMultiplier =
0.5 + (demand / 200);


const trustMultiplier =
0.7 + (trust / 300);



const value =
Number(
(
base *
freshnessMultiplier *
demandMultiplier *
trustMultiplier
).toFixed(2)
);



return {

base_value:base,

freshness_score:freshness,

demand_score:demand,

trust_score:trust,

economic_value:value

};

}



async function evaluate(assetId){


const result =
await pool.query(
`
SELECT *
FROM food_assets
WHERE id=$1
`,
[assetId]
);



if(!result.rows[0]){

throw new Error("Asset not found");

}



const valuation =
calculateValue(
result.rows[0]
);



const saved =
await pool.query(
`
INSERT INTO food_brain_economic_values
(
asset_id,
base_value,
economic_value,
freshness_score,
demand_score,
trust_score
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
assetId,
valuation.base_value,
valuation.economic_value,
valuation.freshness_score,
valuation.demand_score,
valuation.trust_score
]
);



return {

asset_id:assetId,

valuation,

record:saved.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_economic_values
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);


return result.rows;

}



module.exports={
evaluate,
history
};
