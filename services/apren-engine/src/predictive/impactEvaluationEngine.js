function evaluate(prediction){


let protection=50;


let waste=50;


let benefit=50;



if(prediction.prediction.freshness > 70){

protection=90;

waste=95;

}


if(prediction.prediction.demand > 80){

benefit=90;

}



return {

scenario:prediction.scenario,

scores:{

value_protection:protection,

waste_prevention:waste,

user_benefit:benefit

}

};

}



module.exports={
evaluate
};
