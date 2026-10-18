function evaluate(data){

let risk="LOW";

let score=90;


if(data.freshness !== undefined &&
data.freshness < 20){

risk="HIGH";
score=40;

}

else if(
data.freshness !== undefined &&
data.freshness < 40
){

risk="MEDIUM";
score=65;

}


return {

risk,
score

};

}


module.exports={
evaluate
};
