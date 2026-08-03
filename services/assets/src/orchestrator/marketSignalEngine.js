function generateMarketSignal(data){

let signal="NEUTRAL";

let adjustment=0;


if(
data.freshness >= 80 &&
data.demand >= 80 &&
data.trust >= 70
){

signal="POSITIVE";

adjustment=15;

}

else if(
data.freshness < 40 &&
data.demand > 70
){

signal="URGENT";

adjustment=-10;

}

else if(
data.freshness <= 0
){

signal="NEGATIVE";

adjustment=-100;

}


else if(
data.trust < 30
){

signal="REVIEW";

adjustment=-20;

}


return {

signal,

valuation_adjustment:adjustment

};


}


module.exports={
generateMarketSignal
};
