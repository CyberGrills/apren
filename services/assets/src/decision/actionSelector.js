const scorer =
require("./actionScoringEngine");


function select(simulations){


let best=null;
let highest=-1;


for(const simulation of simulations){


const score =
scorer.score(simulation);


if(score > highest){

highest=score;

best={
scenario:simulation.scenario,
score
};

}

}


return best;

}



module.exports={
select
};
