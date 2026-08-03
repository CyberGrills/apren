

function analyze(data){


if(data.demand==="HIGH"){

return {

agent:"demand",

signal:"HIGH",

recommendation:"INCREASE_VISIBILITY",

confidence:90

};

}


return {

agent:"demand",

signal:"NORMAL",

recommendation:"MONITOR",

confidence:60

};


}


module.exports={analyze};

