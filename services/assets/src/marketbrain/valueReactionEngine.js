

function react(data){


let reaction="HOLD";

let value=data.value || 50;


if(data.demand==="HIGH")
{

value += 10;
reaction="VALUE_INCREASE";

}


if(data.freshness < 30)
{

value -= 15;
reaction="URGENCY_ADJUSTMENT";

}


if(value<0)
value=0;


return {

newValue:value,

reaction

};

}


module.exports={
react
};

