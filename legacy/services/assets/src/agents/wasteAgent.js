

function analyze(data){


if(data.wasteRisk==="HIGH" || data.freshness < 20){


return {

agent:"waste",

signal:"RISK",

recommendation:"REDIRECT",

confidence:95

};

}



return {

agent:"waste",

signal:"LOW",

recommendation:"NORMAL_FLOW",

confidence:60

};


}


module.exports={analyze};


