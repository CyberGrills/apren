const { pool } = require("../postgres");


const brain =
require("../brain/foodBrainEngine");

const lifecycle =
require("../lifecycle/lifecycleEngine");

const decision =
require("../intelligence/decisionEngine");

const market =
require("./marketSignalEngine");



async function orchestrate(assetId){


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



const freshness =
Number(item.freshness_score || 0);



const life =
await lifecycle.updateLifecycle({

asset_id:assetId,

freshness,

market_value:item.current_value || 0,

reason:"Brain automatic lifecycle evaluation"

});



const intelligence =
await decision.evaluateAsset(
assetId
);



const brainResult =
await brain.analyze(
assetId
);



const signal =
market.generateMarketSignal({

freshness,

demand:Number(item.demand_score || 0),

trust:Number(item.trust_score || 0)

});




const result =
await pool.query(
`
INSERT INTO food_brain_cycles
(
asset_id,
lifecycle_state,
brain_action,
market_signal,
valuation_change,
executed
)

VALUES
($1,$2,$3,$4,$5,true)

RETURNING *
`,
[
assetId,
life.state,
brainResult.brain_action,
signal.signal,
signal.valuation_adjustment
]
);



return {

asset_id:assetId,

lifecycle:life.state,

brain_action:
brainResult.brain_action,

decision:
intelligence.decision,

market_signal:
signal.signal,

valuation_adjustment:
signal.valuation_adjustment,

executed:true,

cycle:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_cycles
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
orchestrate,
history
};
