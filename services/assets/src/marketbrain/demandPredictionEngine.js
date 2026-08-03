

function predict(data){


let confidence=50;

let prediction="STABLE";


if(data.demand==="HIGH"){

confidence+=25;
prediction="DEMAND_INCREASE";

}


if(data.supply==="LOW"){

confidence+=15;

}


if(data.freshness < 30){

prediction="VALUE_RISK";

confidence+=10;

}


if(confidence>100)
confidence=100;


return {

prediction,

confidence

};

}



module.exports={
predict
};

