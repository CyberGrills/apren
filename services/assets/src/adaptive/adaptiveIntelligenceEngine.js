
const learning =
require("./adaptiveLearningEngine");

const confidence =
require("./confidenceAdjustmentEngine");


async function adapt(assetId){

const learningState =
await learning.evaluate(assetId);


const confidenceState =
confidence.adjust(
learningState
);


return {

asset_id:assetId,

learning:learningState,

confidence:confidenceState

};

}


module.exports={
adapt
};

