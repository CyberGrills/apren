

const memory =
require("./decisionMemoryEngine");


const priority =
require("../priority/contextPriorityEngine");


const strategy =
require("../strategy/actionStrategyEngine");


const risk =
require("../strategy/riskRewardEngine");


const decisionEngine =
require("../decision/decisionEngine");



async function run(assetId,data){


const priorityResult =
priority.evaluate(data);



const riskResult =
risk.evaluate(data);



const strategyResult =
strategy.create(
data,
riskResult
);


const decisionResult =
decisionEngine.decide(data);



const decision={

action:decisionResult.action,

confidence:decisionResult.confidence,

priority:priorityResult.priority,

steps:strategyResult.steps

};



await memory.remember(
assetId,
"DECISION",
data,
decision,
Math.max(
priorityResult.score,
riskResult.reward
)
);



return {

decision,

priority:priorityResult,

risk:riskResult,

strategy:strategyResult

};


}



module.exports={
run
};


