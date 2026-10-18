const { pool } = require("../postgres");

const recommendation =
require("./recommendationEngine");


const rules =
require("../rules/ruleEngine");


async function analyze(assetId){


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

freshness:item.freshness_score,

trust:item.trust_score,

demand:item.demand_score,

supply:item.available_supply

};



const ruleResult =
await rules.evaluate(context);



const recommendationResult =
recommendation.generateRecommendation(context);



const finalAction =
ruleResult.allowed
?
recommendationResult.action
:
"BLOCK_TRADE";



const result =
await pool.query(
`
INSERT INTO food_brain_actions
(
asset_id,
action,
reason,
confidence,
allowed
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
assetId,
finalAction,
recommendationResult.reason,
recommendationResult.confidence,
ruleResult.allowed
]
);



return {

asset_id:assetId,

brain_action:finalAction,

recommendation:recommendationResult,

rules:ruleResult,

record:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_actions
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
analyze,
history
};
