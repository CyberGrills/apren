

const market =
require("../marketbrain/marketReactionBrainEngine");

const negotiation =
require("../negotiation/agentNegotiationBrainEngine");

const autonomy =
require("../autonomy/autonomousBrainEngine");

const execution =
require("../execution/executionGatewayEngine");

const coordinator =
require("./decisionCoordinatorEngine");

const learner =
require("./learningFeedbackEngine");

const {pool}=require("../postgres");



async function orchestrate(assetId,data){


const marketResult =
await market.analyze(
assetId,
data
);



const negotiationResult =
await negotiation.negotiate(
assetId,
data
);



const actionResult =
await autonomy.decide(
assetId,
data
);



const decision =
coordinator.coordinate(
marketResult,
negotiationResult,
actionResult
);



let executionResult =
{
status:"WAITING_APPROVAL"
};



if(data.approved===true){

executionResult =
await execution.execute(
assetId,
{
action:decision.decision,
approved:true,
confidence:decision.confidence
}
);

}



await learner.learn({

assetId,

action:decision.decision,

result:executionResult,

score:decision.confidence

});



const cycle =
await pool.query(
`
INSERT INTO food_brain_orchestrator_cycles
(
asset_id,
cycle_input,
market_result,
negotiation_result,
action_result,
execution_result,
confidence,
status
)

VALUES($1,$2,$3,$4,$5,$6,$7,$8)

RETURNING *
`,
[
assetId,
JSON.stringify(data),
JSON.stringify(marketResult),
JSON.stringify(negotiationResult),
JSON.stringify(actionResult),
JSON.stringify(executionResult),
decision.confidence,
"COMPLETE"
]
);



return {

asset_id:assetId,

brain_status:"COMPLETE",

decision,

market:marketResult,

negotiation:negotiationResult,

action:actionResult,

execution:executionResult,

cycle:cycle.rows[0]

};


}



module.exports={
orchestrate
};

