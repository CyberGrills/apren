
const demand =
require("./demandIntelligenceEngine");

const memory =
require("./collectiveMemoryEngine");

const {pool}=require("../postgres");



async function analyze(assetId,data){


const demandResult =
demand.analyze(
data.signals || []
);



const collective =
await memory.remember(

"DEMAND_PATTERN",

`${data.region}:${assetId}`,

{
assetId,
region:data.region,
demand:demandResult
},

85

);



return {

asset_id:assetId,

region:data.region,

demand:demandResult,

memory:collective

};

}


module.exports={
analyze
};

