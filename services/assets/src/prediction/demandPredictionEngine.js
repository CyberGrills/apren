function predict(data){

const demand =
Number(data.demand || 0);


const trend =
Number(data.trend || 0);



let future =
Math.round(
demand + trend
);



future=Math.min(
100,
Math.max(
0,
future
)
);



return {

current_demand:demand,

predicted_demand:future

};

}


module.exports={
predict
};
