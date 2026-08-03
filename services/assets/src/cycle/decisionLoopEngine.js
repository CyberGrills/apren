

const memory =
require("./decisionMemoryEngine");


const priority =
require("../priority/contextPriorityEngine");


const strategy =
require("../strategy/actionStrategyEngine");


const risk =
require("../strategy/riskRewardEngine");



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



const decision={

action:strategyResult.strategy,

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


