

const riskReward =
require("./riskRewardEngine");

const strategy =
require("./actionStrategyEngine");

const {pool}=require("../postgres");



async function generate(assetId,data){


const evaluation =
riskReward.evaluate(data);


const plan =
strategy.create(
data,
evaluation
);



await pool.query(
`
INSERT INTO food_brain_strategies
(
asset_id,
strategy_type,
strategy,
expected_result,
risk_score,
confidence
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
assetId,
plan.strategy,
JSON.stringify(plan.steps),
JSON.stringify(evaluation),
evaluation.risk,
Math.abs(evaluation.balance)
]
);



return {

asset_id:assetId,

strategy:plan,

evaluation

};


}



module.exports={
generate
};

