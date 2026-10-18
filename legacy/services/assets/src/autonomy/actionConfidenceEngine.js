

function evaluate(plan){


let confidence =
plan.confidence;


if(plan.reasoning.length>=2){

confidence +=5;

}


if(confidence>100){

confidence=100;

}


return confidence;

}


module.exports={
evaluate
};

