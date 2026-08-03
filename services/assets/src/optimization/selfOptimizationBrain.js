

const outcome =
require("./strategyOutcomeEngine");

const learner =
require("./selfLearningEngine");



async function optimize(assetId,data){


await outcome.record({

assetId,

strategy:data.strategy,

expected:data.expected,

actual:data.actual,

score:data.score,

notes:data.notes

});



const learning =
await learner.learn({

strategy:data.strategy,

pattern:data.pattern

});



return {

asset_id:assetId,

optimization:"COMPLETE",

learning

};


}



module.exports={
optimize
};

