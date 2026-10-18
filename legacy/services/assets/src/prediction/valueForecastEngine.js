

function forecast(data){

let value=data.value || 50;

let prediction="VALUE_STABLE";

let confidence=50;

let action="HOLD";


if(data.demand==="HIGH"){

value+=10;

prediction="VALUE_INCREASE_EXPECTED";

confidence+=25;

action="PROMOTE";

}


if(data.freshness < 30){

value-=15;

prediction="VALUE_DROP_RISK";

confidence+=25;

action="ADJUST_PRICE";

}


return {

future_value:value,

prediction,

confidence,

action

};

}



module.exports={
forecast
};

