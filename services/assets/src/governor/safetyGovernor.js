function check(data){

let allowed=true;
let reason="Safety checks passed";


if(
data.decision==="BLOCK_TRADE"
){

allowed=true;
reason="Blocking trade is allowed for food safety";

}


if(
data.confidence < 40
){

allowed=false;
reason="Confidence too low";

}


return {

allowed,

reason

};

}


module.exports={check};
