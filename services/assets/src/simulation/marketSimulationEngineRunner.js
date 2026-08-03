
const scenario =
require("./scenarioEngine");

const simulator =
require("./marketSimulationEngine");

const risk =
require("./riskSimulationEngine");

const memory =
require("./marketSimulationMemoryEngine");



async function run(assetId,data){


const created =
scenario.createScenario(data);


const result =
simulator.simulate(
data
);


const riskLevel =
risk.evaluate(
result
);



return await memory.remember({

assetId,

scenario:riskLevel,

input:created,

output:{
...result,
risk:riskLevel
},

confidence:90

});


}



module.exports={
run
};

