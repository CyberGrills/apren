
function predict(state){


let scenarios=[];


let baseValue =
state.market.value || 0;



scenarios.push({

name:"SELL_NOW",

value:
baseValue,

risk:"LOW"

});



scenarios.push({

name:"WAIT",

value:
baseValue *
0.75,

risk:
state.freshness < 40
?
"HIGH"
:
"MEDIUM"

});



if(state.demand==="HIGH"){

scenarios.push({

name:"PROMOTE",

value:
baseValue * 1.20,

risk:"LOW"

});

}



return scenarios;

}


module.exports={
predict
};

