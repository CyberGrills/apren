

function predict(data){


let value=data.value || 50;

let direction="STABLE";

let confidence=60;



if(data.demand==="HIGH"){

value +=20;

direction="UP";

confidence=90;

}



if(data.supply==="LOW"){

value +=15;

confidence=95;

}



return {

prediction:"VALUE_"+direction,

estimated_value:value,

confidence

};


}


module.exports={
predict
};

