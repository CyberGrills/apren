const supply =
require("./supplyIntelligenceEngine");

const demand =
require("./demandForecastEngine");

const opportunity =
require("./opportunityAgent");


async function analyze(assetId,data){

const supplyResult =
supply.analyze(data);


const opportunityResult =
opportunity.analyze(data);


return {

asset_id:assetId,

supply:supplyResult,

opportunity:opportunityResult

};

}



module.exports={
analyze
};
