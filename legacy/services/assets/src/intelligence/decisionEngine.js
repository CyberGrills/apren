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
