

function analyze(memories){


let confidence=50;

let pattern="NORMAL_ACTIVITY";


const text =
JSON.stringify(memories);



if(text.includes("DISTRIBUTE_FAST")){

pattern="FAST_DISTRIBUTION_PATTERN";

confidence+=30;

}



if(text.includes("HIGH")){

pattern="HIGH_DEMAND_PATTERN";

confidence+=20;

}



if(confidence>100)
confidence=100;


return {

pattern,

confidence

};

}



module.exports={
analyze
};

