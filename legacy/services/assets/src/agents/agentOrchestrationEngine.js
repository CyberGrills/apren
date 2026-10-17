const coordinator =
require("./agentCoordinator");


const execution =
require("./agentExecutionEngine");


const communication =
require("./agentCommunicationEngine");



async function orchestrate(assetId,data){


const council =
coordinator.coordinate(data);



let action="HOLD";


if(
data.freshness < 30 &&
data.demand > 70
){

action="FAST_MOVE";

}
else if(
data.demand > 80
){

action="PROMOTE";

}
else if(
data.supply < data.demand
){

action="INCREASE_SUPPLY";

}



const result =
execution.execute(action);



await communication.broadcast({

agent:"orchestrator",

message:
"Agent council decision generated",

confidence:
data.confidence || 50,

payload:{
assetId,
council,
result
}

});



return {

asset_id:assetId,

council,

decision:result

};

}



module.exports={
orchestrate
};
