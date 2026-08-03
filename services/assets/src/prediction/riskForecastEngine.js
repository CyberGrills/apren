
function evaluate(freshness){


if(freshness < 40){

return "HIGH";

}


if(freshness < 70){

return "MEDIUM";

}


return "LOW";

}


module.exports={
evaluate
};

