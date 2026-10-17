const freshness =
require("./freshnessEngine");


async function analyzeEvidence(data){


const result =
freshness.calculateFreshness(data);



return {

food_name:data.food_name,

image:data.image || null,

video:data.video || null,

freshness:result,

confidence:
data.confidence || 50


};


}


module.exports={
analyzeEvidence
};
