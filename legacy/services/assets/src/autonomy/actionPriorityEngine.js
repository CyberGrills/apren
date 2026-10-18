
function calculate(data){

let priority=50;


if(data.freshness < 30){

priority += 25;

}


if(data.demand==="HIGH"){

priority += 20;

}


if(data.supply==="LOW"){

priority += 10;

}


if(priority>100){

priority=100;

}


return priority;

}


module.exports={
calculate
};

