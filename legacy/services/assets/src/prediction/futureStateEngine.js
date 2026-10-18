const freshness =
require("./freshnessPredictionEngine");


const demand =
require("./demandPredictionEngine");


const value =
require("./valuePredictionEngine");



function calculate(data){


const fresh =
freshness.predict(data);


const market =
demand.predict(data);


const price =
value.predict({

value:data.value,

freshness:
fresh.predicted_freshness

});



let recommendation="HOLD";


if(
fresh.predicted_freshness < 30 &&
market.predicted_demand > 70
){

recommendation="FAST_MOVE";

}

else if(
market.predicted_demand > 80
){

recommendation="PROMOTE";

}



return {

freshness:fresh,

demand:market,

value:price,

recommendation

};

}



module.exports={
calculate
};
