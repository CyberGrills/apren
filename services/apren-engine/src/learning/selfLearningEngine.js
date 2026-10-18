
const accuracy =
require("./accuracyEngine");

const memory =
require("./selfLearningMemoryEngine");



async function learn(assetId,data){


const score =
accuracy.calculate(
data.prediction,
data.actual
);



return await memory.remember({

assetId,

type:"EVOLUTION_MODEL",

state:{
lastPrediction:data.prediction,
lastActual:data.actual,
learningScore:score
},

accuracy:score,

confidence:score

});


}



module.exports={
learn
};

