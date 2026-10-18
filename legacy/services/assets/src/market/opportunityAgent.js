function analyze(data){


let opportunity="HOLD";

let reason="Market conditions stable";



if(
data.freshness < 30 &&
data.demand > 70
){

opportunity="FAST_SELL";

reason="High demand with freshness risk";

}

else if(
data.demand > 80 &&
data.freshness > 70
){

opportunity="PROMOTE";

reason="Strong demand and healthy freshness";

}

else if(
data.supply < data.demand
){

opportunity="INCREASE_SUPPLY";

reason="Demand exceeds available supply";

}



return {

opportunity,

reason

};

}



module.exports={
analyze
};
