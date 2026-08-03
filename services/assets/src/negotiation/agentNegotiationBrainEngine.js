
const argument =
require("./agentArgumentEngine");

const debate =
require("./agentDebateEngine");

const consensus =
require("./consensusEngine");

const memory =
require("./negotiationMemoryEngine");

const {pool}=require("../postgres");



async function negotiate(assetId,data){


const argumentsList =
argument.argue(data);



const ranked =
debate.debate(argumentsList);



const decision =
consensus.decide(ranked);



await memory.remember({

assetId,

arguments:ranked,

decision:decision.decision,

confidence:decision.confidence

});



await pool.query(
`
INSERT INTO food_brain_consensus_decisions
(
asset_id,
decision,
agent_votes,
confidence
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
decision.decision,
JSON.stringify(ranked),
decision.confidence
]
);



return {

asset_id:assetId,

negotiation:ranked,

consensus:decision

};


}



module.exports={
negotiate
};

