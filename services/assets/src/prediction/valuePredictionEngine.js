function predict(data){

const value =
Number(data.value || 0);


const freshness =
Number(data.freshness || 0);



const multiplier =
0.5 + freshness / 200;



const futureValue =
Number(
(value * multiplier)
.toFixed(2)
);



return {

current_value:value,

predicted_value:futureValue

};

}



module.exports={
predict
};
