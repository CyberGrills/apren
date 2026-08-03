
function explain(data){


let reasons=[];


if(data.freshness < 50){

reasons.push(
"freshness window declining"
);

}


if(data.demand==="HIGH"){

reasons.push(
"market demand increasing"
);

}


if(data.simulationRisk==="HIGH"){

reasons.push(
"value loss risk detected"
);

}


if(data.autonomy==="AUTONOMOUS"){

reasons.push(
"user permits autonomous optimization"
);

}


return reasons;

}


module.exports={
explain
};

