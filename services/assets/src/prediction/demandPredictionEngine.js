

function predict(data){

let demand="STABLE";
let confidence=60;


if(data.demand==="HIGH"){

demand="INCREASING";
confidence=90;

}


if(data.supply==="LOW" && data.demand==="HIGH"){

demand="SURGING";
confidence=95;

}


return {

prediction:"DEMAND_"+demand,

confidence

};

}


module.exports={
predict
};

