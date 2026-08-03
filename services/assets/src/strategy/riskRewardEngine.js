

function evaluate(data){

let risk=30;
let reward=50;


if(data.demand==="HIGH"){
reward+=30;
}


if(data.freshness < 20){
risk+=40;
}


if(data.supply==="LOW"){
reward+=20;
}


if(risk>100)
risk=100;


if(reward>100)
reward=100;


return {

risk,
reward,

balance:
reward-risk

};

}


module.exports={
evaluate
};

