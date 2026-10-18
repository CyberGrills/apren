function calculate(signals){


let confidence=50;



if(
signals.freshness !== undefined
){

confidence+=10;

}


if(
signals.demand !== undefined
){

confidence+=10;

}


if(
signals.prediction_confidence
){

confidence+=signals.prediction_confidence / 5;

}



return Math.min(
100,
Math.round(confidence)
);


}



module.exports={
calculate
};
