
function calculate(prediction,actual){

let score=50;


if(
prediction.action === actual.action
){

score += 30;

}


if(
prediction.value &&
actual.value
){

const difference =
Math.abs(
prediction.value -
actual.value
);


if(difference < 10){

score +=20;

}

}


if(score>100){

score=100;

}


return score;

}


module.exports={
calculate
};

