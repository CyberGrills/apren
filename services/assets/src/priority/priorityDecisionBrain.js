

const priority =
require("./contextPriorityEngine");

const {pool}=require("../postgres");



async function decide(assetId,data){


const decision =
priority.evaluate(data);



await pool.query(
`
INSERT INTO food_brain_priority_decisions
(
asset_id,
winning_signal,
priority_score,
decision,
reasoning,
confidence
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
assetId,
decision.priority,
decision.score,
decision.priority,
JSON.stringify(decision.reason),
decision.score
]
);



return {

asset_id:assetId,

priority_decision:decision

};


}



module.exports={
decide
};

