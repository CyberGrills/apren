
function optimize(data){


let confidence=70;


if(data.freshness < 50){

confidence+=10;

}


if(data.signals &&
data.signals.includes("HIGH_DEMAND")){

confidence+=12;

}



if(confidence>100){

confidence=100;

}


return {

optimization:"VALUE_PROTECTION",

confidence

};

}



module.exports={
optimize
};

