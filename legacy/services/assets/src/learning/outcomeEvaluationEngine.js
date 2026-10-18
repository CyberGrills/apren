
function evaluate(result){


let status="UNKNOWN";

let signal="NEUTRAL";


if(result.status==="SUCCESS" ||
result.status==="SIMULATED"){

status="SUCCESS";

signal="POSITIVE";

}



if(result.status==="FAILED"){

status="FAILURE";

signal="NEGATIVE";

}



return {

status,

signal

};

}



module.exports={
evaluate
};

