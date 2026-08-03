
const decision =
require("./decisionEngine");

const memory =
require("./decisionMemoryEngine");



async function evaluate(assetId,data){


const result =
decision.decide(data);



return await memory.remember({

assetId,

action:
result.action,

reasoning:
result.reasoning,

signals:data,

confidence:
result.confidence,

mode:
data.autonomy || "ASSISTED"

});


}


module.exports={
evaluate
};

