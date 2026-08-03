
const memory =
require("./memoryRetrievalEngine");

const pattern =
require("./patternRecognitionEngine");


async function learn(assetId){


const memories =
await memory.retrieve(assetId);


const analysis =
pattern.analyze(memories);


return {

asset_id:assetId,

experience:analysis

};

}


module.exports={
learn
};

