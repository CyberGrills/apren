
function predict(value,freshness){


let predicted=value;


if(freshness < 50){

predicted=value*0.7;

}


else if(freshness < 75){

predicted=value*0.85;

}



return Number(
predicted.toFixed(2)
);

}



module.exports={
predict
};

