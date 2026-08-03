

function forecast(data){

let prediction="DEMAND_NORMAL";

let confidence=50;

let action="MONITOR";


if(data.demand==="HIGH"){

prediction="DEMAND_SURGE_EXPECTED";

confidence+=35;

action="INCREASE_VISIBILITY";

}


if(data.supply==="LOW"){

confidence+=15;

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
forecast
};

