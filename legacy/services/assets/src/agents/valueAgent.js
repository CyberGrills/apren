

function analyze(data){


if(data.valueRisk==="HIGH"){

return {

agent:"value",

signal:"RISK",

recommendation:"PROTECT_VALUE",

confidence:85

};

}



return {

agent:"value",

signal:"STABLE",

recommendation:"MAINTAIN",

confidence:65

};


}


module.exports={analyze};

