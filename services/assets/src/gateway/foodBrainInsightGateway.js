

const prediction =
require("../prediction/predictiveBrain");

const simulation =
require("../simulation/simulationBrain");

const memory =
require("../memory/brainExperienceEngine");

const agents =
require("../agents/agentCollaborationEngine");

const {pool}=require("../postgres");



async function insight(assetId,data){


const brainPrediction =
await prediction.predict(
assetId,
data
);



const brainSimulation =
await simulation.simulate(
assetId,
data
);



const brainMemory =
await memory.learn(
assetId
);



const brainAgents =
await agents.collaborate(
assetId,
data
);



const response = {


asset_id:assetId,


brain_status:"ACTIVE",



freshness:{

prediction:
brainPrediction.prediction.future_state[1]

},



market:{

prediction:
brainPrediction.prediction.future_state[0]

},



value:{

prediction:
brainPrediction.prediction.future_state[2]

},



recommended_action:
brainSimulation.recommended_path,



agent_consensus:
brainAgents.consensus,



experience:
brainMemory.experience


};



await pool.query(
`
INSERT INTO food_brain_insights
(
asset_id,
insight_type,
insight,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
"FOOD_BRAIN_SUMMARY",
JSON.stringify(response),
response.agent_consensus.confidence
]
);



return response;


}



module.exports={
insight
};


