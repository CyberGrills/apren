

function predict(data){

let risk="LOW";

let confidence=40;

let action="NORMAL_FLOW";


if(data.freshness < 30){

risk="HIGH";

confidence+=40;

action="REDUCE_WASTE";

}


if(data.demand==="LOW"){

risk="CRITICAL";

confidence+=20;

action="REDIRECT_ASSET";

}


if(confidence>100)
confidence=100;


return {

risk,

confidence,

action

};

}


module.exports={
predict
};

