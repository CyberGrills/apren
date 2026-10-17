
function evaluate(result){


if(result.future_value < 1){

return "HIGH";

}


if(result.demand_state==="LOW"){

return "MEDIUM";

}


return "LOW";

}


module.exports={
evaluate
};

