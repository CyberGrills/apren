
const evaluator =
require("./outcomeEvaluationEngine");

const adaptation =
require("./confidenceAdaptationEngine");

const memory =
require("./learningMemoryEngine");



async function learn(assetId,data){


const evaluation =
evaluator.evaluate(
data.result
);



const newConfidence =
adaptation.adapt(
data.confidence || 0,
evaluation.status
);



return await memory.remember({

assetId,

decision:data.decision,

result:data.result,

status:evaluation.status,

confidenceBefore:data.confidence || 0,

confidenceAfter:newConfidence,

signal:evaluation.signal

});


}



module.exports={
learn
};

