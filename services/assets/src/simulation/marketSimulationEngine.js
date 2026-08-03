
function simulate(data){


let price=data.currentValue || 0;


price += price *
(
(data.demandChange || 0)
-
(data.supplyChange || 0)
+
(data.priceChange || 0)
)
/
100;



if(price < 0){

price=0;

}



let demand="NORMAL";


if((data.demandChange || 0)>20){

demand="HIGH";

}


if((data.demandChange || 0)<-20){

demand="LOW";

}



return {

future_value:Number(price.toFixed(2)),

demand_state:demand

};


}


module.exports={
simulate
};

