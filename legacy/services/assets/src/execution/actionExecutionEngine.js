
const permission =
require("./actionPermissionEngine");

const planner =
require("./actionPlannerEngine");

const memory =
require("./executionMemoryEngine");



async function execute(assetId,data){


const access =
permission.check(data);



if(!access.allowed){

throw new Error(
"Execution denied"
);

}



const plan =
planner.create({

assetId,

action:data.action

});



const savedPlan =
await memory.plan({

assetId,

action:data.action,

mode:access.mode,

requirements:plan.requirements

});



const execution = {

status:"SIMULATED_EXECUTION",

message:
"Action execution pipeline ready",

next:
"Connect wallet/trade services"

};



const savedResult =
await memory.result({

planId:savedPlan.id,

status:"SUCCESS",

output:execution,

signal:"POSITIVE"

});



return {

plan:savedPlan,

result:savedResult

};


}



module.exports={
execute
};

