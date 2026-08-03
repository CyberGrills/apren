
function analyze(signals){

let score=50;


for(const signal of signals){

if(signal==="HIGH_DEMAND"){

score+=20;

}


if(signal==="LOW_SUPPLY"){

score+=15;

}

}



if(score>100){

score=100;

}


let level="NORMAL";


if(score>=75){

level="HIGH";

}

else if(score<=35){

level="LOW";

}



return {

demand_score:score,

demand_level:level

};

}


module.exports={
analyze
};

