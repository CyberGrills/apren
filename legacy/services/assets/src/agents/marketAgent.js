

function analyze(data){


if(data.supply==="LOW" && data.demand==="HIGH"){


return {

agent:"market",

signal:"OPPORTUNITY",

recommendation:"MAXIMIZE_DISTRIBUTION",

confidence:90

};

}



return {

agent:"market",

signal:"BALANCED",

recommendation:"NORMAL_TRADING",

confidence:60

};


}


module.exports={analyze};


