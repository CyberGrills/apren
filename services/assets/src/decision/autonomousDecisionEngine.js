const selector =
require("./actionSelector");


const reasoning =
require("./reasoningEngine");


const {pool}=require("../postgres");



async function decide(assetId, simulations){


const selected =
selector.select(simulations);


const explanation =
reasoning.explain(selected);



const result =
await pool.query(
`
INSERT INTO food_brain_autonomous_decisions
(
asset_id,
decision,
reason,
confidence,
simulation_score
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
assetId,
selected.scenario,
explanation.reason,
selected.score >=200 ? 90 : 70,
selected.score
]
);



return {

asset_id:assetId,

autonomous_decision:selected,

reasoning:explanation,

record:result.rows[0]

};


}



module.exports={
decide
};
