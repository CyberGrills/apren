function predict(data,scenario){


let freshness =
data.freshness || 100;


let demand =
data.demand || 50;


let value =
data.value || 0;



if(scenario.action==="WAIT"){

freshness -= scenario.hours * 2;

}


if(scenario.action==="BOOST"){

demand += 15;

}


if(scenario.action==="EXCHANGE"){

value += 5;

}



return {

scenario:scenario.scenario,

future_hours:scenario.hours,

prediction:{

freshness:Math.max(freshness,0),

demand,

value,

risk:
freshness < 30
?"HIGH"
:"NORMAL"

}

};

}



module.exports={
predict
};
