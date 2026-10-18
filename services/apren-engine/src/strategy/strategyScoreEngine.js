
function score(result){

let score=50;


if(result.sales){

score += Math.min(
30,
result.sales / 10
);

}


if(result.waste){

score -= Math.min(
20,
result.waste
);

}


if(result.profit){

score += Math.min(
20,
result.profit / 10
);

}


if(score>100)
score=100;


if(score<0)
score=0;


return score;

}



module.exports={
score
};

