

function simulate(scenario,data){


let value=data.value || 50;

let score=50;



if(scenario.name==="SELL_NOW"){

value += 5;

score += 20;

}



if(scenario.name==="WAIT"){

value -= 15;

score -= 20;

}



if(scenario.name==="REDIRECT"){

value += 20;

score += 30;

}



if(data.demand==="HIGH"){

score += 15;

}



if(scenario.freshness < 20){

score -= 25;

}



return {

scenario:scenario.name,

predicted_value:value,

score,

reason:scenario.description

};


}


module.exports={
simulate
};


