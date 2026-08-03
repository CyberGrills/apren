
const market =
require("./marketPredictionEngine");


function forecast(value,freshness){


return market.predict(
value,
freshness
);


}


module.exports={
forecast
};

