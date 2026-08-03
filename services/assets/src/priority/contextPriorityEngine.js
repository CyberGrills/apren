

function evaluate(data){


let winner="MONITOR";
let score=20;
let reason=[];



if(data.freshness < 15){

winner="FRESHNESS_CRITICAL";
score=100;

reason.push(
"immediate freshness danger"
);

}


else if(data.freshness < 30){

winner="FRESHNESS_RISK";
score=90;

reason.push(
"freshness declining"
);

}



if(data.wasteRisk==="HIGH"){

winner="WASTE_PREVENTION";
score=Math.max(score,95);

reason.push(
"waste probability high"
);

}



if(data.demand==="HIGH" && score < 90){

winner="DEMAND_OPPORTUNITY";
score=70;

reason.push(
"demand opportunity"
);

}



if(data.valueRisk==="HIGH" && score < 70){

winner="VALUE_PROTECTION";
score=60;

reason.push(
"value protection"
);

}



return {

priority:winner,

score,

reason

};

}



module.exports={
evaluate
};

