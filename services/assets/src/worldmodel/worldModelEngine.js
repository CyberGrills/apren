
const state =
require("./stateBuilderEngine");

const predictor =
require("./scenarioPredictionEngine");

const memory =
require("./futureMemoryEngine");



async function imagine(assetId,data){


const world =
state.build(data);


const futures =
predictor.predict(world);



const saved=[];


for(const future of futures){

saved.push(
await memory.remember({

assetId,

name:
future.name,

state:
world,

value:
future.value,

risk:
future.risk,

confidence:85

})
);

}



return {

asset_id:assetId,

current_world:world,

future_scenarios:saved

};

}



module.exports={
imagine
};

