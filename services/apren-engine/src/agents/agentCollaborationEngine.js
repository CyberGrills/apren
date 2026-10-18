

const freshness =
require("./freshnessAgent");

const demand =
require("./demandAgent");

const value =
require("./valueAgent");

const waste =
require("./wasteAgent");

const market =
require("./marketAgent");


const {pool}=require("../postgres");



async function collaborate(assetId,data){


const agents=[

freshness.analyze(data),

demand.analyze(data),

value.analyze(data),

waste.analyze(data),

market.analyze(data)

];



let decision="NORMAL_FLOW";

let score=0;



for(const agent of agents){

score += agent.confidence;


if(
agent.recommendation==="MOVE_FAST" ||
agent.recommendation==="REDIRECT"
){

decision="FAST_DISTRIBUTION";

}

}



let consensus =
Math.round(score / agents.length);



await pool.query(
`
INSERT INTO food_brain_agent_decisions
(
asset_id,
participating_agents,
final_decision,
consensus_score
)

VALUES($1,$2,$3,$4)
`,
[
assetId,
JSON.stringify(agents),
decision,
consensus
]
);



for(const agent of agents){

await pool.query(
`
INSERT INTO food_brain_agents
(
asset_id,
agent_name,
signal,
recommendation,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
agent.agent,
agent.signal,
agent.recommendation,
agent.confidence
]
);

}



return {

asset_id:assetId,

agents,

consensus:{
decision,
confidence:consensus
}

};


}



module.exports={
collaborate
};


