

function analyze(events){

let score=50;


if(events.includes("DEMAND_SPIKE"))
score+=25;


if(events.includes("FRESHNESS_DROP"))
score+=15;


if(score>100)
score=100;


return {

pattern:"FOOD_VALUE_MOVEMENT",

confidence:score

};

}



module.exports={
analyze
};

