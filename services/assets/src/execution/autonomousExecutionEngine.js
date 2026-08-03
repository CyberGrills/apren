const authorization =
require("./actionAuthorizationEngine");

const planner =
require("./executionPlanner");

const executor =
require("./actionExecutor");

const memory =
require("./outcomeMemoryEngine");



async function execute(assetId,decision){


const approval =
authorization.authorize(
decision.scenario
);



if(!approval.authorized){

return {

status:"BLOCKED",

approval

};

}



const plan =
planner.plan(decision);



const result =
await executor.execute(plan);



const record =
await memory.remember(
assetId,
result
);



return {

asset_id:assetId,

approval,

plan,

execution:result,

record

};

}



module.exports={
execute
};

