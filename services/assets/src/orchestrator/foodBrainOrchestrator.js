

const prediction =
require("../prediction/predictiveBrain");

const simulation =
require("../simulation/simulationBrain");

const agents =
require("../agents/agentCollaborationEngine");

const cycle =
require("../cycle/decisionLoopEngine");

const strategy =
require("../strategy/actionStrategyEngine");

const {pool}=require("../postgres");



async function orchestrate(assetId,data){


const predictive =
await prediction.predict(
assetId,
data
);



const simulated =
await simulation.simulate(
assetId,
data
);



const collaboration =
await agents.collaborate(
assetId,
data
);



const decision =
await cycle.run(
assetId,
data
);



const finalStrategy =
strategy.create(
data,
decision.risk
);



let confidence =
Math.round(
(
predictive.prediction.overall_confidence +
collaboration.consensus.confidence
+
simulated.recommended_path.score
) / 3
);



const finalDecision={

action:finalStrategy.strategy,

steps:finalStrategy.steps,

reason:{

prediction:predictive.prediction,

simulation:simulated.recommended_path,

agents:collaboration.consensus,

decision

}

};



await pool.query(
`
INSERT INTO food_brain_orchestrator_decisions
(
asset_id,
input_state,
intelligence_chain,
final_decision,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
JSON.stringify(data),
JSON.stringify({
prediction:true,
simulation:true,
agents:true,
decision:true
}),
JSON.stringify(finalDecision),
confidence
]
);



return {

asset_id:assetId,

brain_status:"AUTONOMOUS",

confidence,

final_decision:finalDecision

};


}



module.exports={
orchestrate
};


