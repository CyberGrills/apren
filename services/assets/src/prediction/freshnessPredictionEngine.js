
function predict(hoursRemaining){

let freshness =
Math.max(
0,
Math.min(
100,
(hoursRemaining / 24) * 100
)
);


return Number(
freshness.toFixed(2)
);

}


module.exports={
predict
};

