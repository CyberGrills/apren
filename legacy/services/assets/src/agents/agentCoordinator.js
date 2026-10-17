function coordinate(signals){


const responses=[];


if(signals.freshness !== undefined){

responses.push({

agent:"freshness",

signal:signals.freshness < 30
? "RISK"
: "NORMAL"

});

}



if(signals.demand !== undefined){

responses.push({

agent:"market",

signal:signals.demand > 70
? "HIGH_DEMAND"
: "NORMAL"

});

}



if(signals.confidence !== undefined){

responses.push({

agent:"trust",

signal:signals.confidence > 70
? "TRUSTED"
: "LOW_CONFIDENCE"

});

}



return responses;

}



module.exports={
coordinate
};
