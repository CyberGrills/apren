const {pool}=require("../postgres");


const council =
require("../agents/agentCouncilEngine");


const safety =
require("./safetyGovernor");


const confidence =
require("./confidenceGovernor");



async function govern(assetId){


const councilDecision =
await council.decide(assetId);



const confidenceResult =
confidence.evaluate(
councilDecision.votes
);



const safetyResult =
safety.check({

decision:councilDecision.decision,

confidence:
confidenceResult.confidence

});



let finalDecision =
councilDecision.decision;



if(
!safetyResult.allowed
){

finalDecision="REVIEW";

}



const result =
await pool.query(
`
INSERT INTO food_brain_governor_decisions
(
asset_id,
council_decision,
final_decision,
confidence,
safety_result
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
assetId,
councilDecision.decision,
finalDecision,
confidenceResult.confidence,
JSON.stringify(safetyResult)
]
);



return {

asset_id:assetId,

council_decision:
councilDecision.decision,

final_decision:
finalDecision,

confidence:
confidenceResult,

safety:
safetyResult,

record:
result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_governor_decisions
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);


return result.rows;

}



module.exports={
govern,
history
};
