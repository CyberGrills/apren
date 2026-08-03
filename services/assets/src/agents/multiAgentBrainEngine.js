
const registry =
require("./agentRegistryEngine");

const communication =
require("./agentCommunicationEngine");

const priority =
require("./agentPriorityEngine");

const decision =
require("./collectiveDecisionEngine");

const memory =
require("./agentMemoryEngine");

const {pool}=require("../postgres");



async function cycle(assetId,data){


await registry.register();



let outputs =
communication.communicate(
assetId,
data
);



outputs =
priority.rank(outputs);



const final =
decision.decide(
outputs,
data
);



await memory.remember({

assetId,

input:data,

outputs

});



await pool.query(
`
INSERT INTO food_brain_collective_decisions
(
asset_id,
decision,
reasoning,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
final.action,
JSON.stringify(outputs),
final.confidence
]
);



return {

asset_id:assetId,

agents:outputs,

collective_decision:final

};


}



module.exports={
cycle
};

