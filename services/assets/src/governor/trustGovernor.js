function evaluate(data){

let trust="ACCEPTED";

let score=90;


if(
data.confidence !== undefined &&
data.confidence < 50
){

trust="REVIEW_REQUIRED";
score=40;

}


else if(
data.confidence !== undefined &&
data.confidence < 70
){

trust="MONITOR";
score=65;

}



return {

trust,
score

};

}


module.exports={
evaluate
};
