function predict(data){

const current =
Number(data.freshness || 0);


const hours =
Number(data.hours || 24);


const decay =
Math.round(
(hours / 24) * 40
);


const future =
Math.max(
0,
current - decay
);


return {

current_freshness:current,

predicted_freshness:future,

hours_ahead:hours

};

}


module.exports={
predict
};
