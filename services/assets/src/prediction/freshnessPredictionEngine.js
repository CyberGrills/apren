

function predict(data){

let prediction="FRESHNESS_STABLE";

let confidence=50;

let action="MONITOR";


if(data.freshness < 30){

prediction="FRESHNESS_COLLAPSE_EXPECTED";

confidence+=35;

action="DISTRIBUTE_FAST";

}


if(data.freshness < 15){

prediction="CRITICAL_FRESHNESS_RISK";

confidence+=15;

action="IMMEDIATE_MOVEMENT";

}


if(confidence>100)
confidence=100;


return {

prediction,

confidence,

action

};

}


module.exports={
predict
};

