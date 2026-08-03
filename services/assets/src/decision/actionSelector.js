function select(signals){

let action="HOLD";

let priority="MEDIUM";

let reason="Market conditions stable";



if(
signals.freshness < 30 &&
signals.demand > 70
){

action="FAST_MOVE";

priority="HIGH";

reason="Freshness risk with strong demand";

}

else if(
signals.demand > 80 &&
signals.freshness > 70
){

action="PROMOTE";

priority="HIGH";

reason="High demand and strong freshness";

}

else if(
signals.supply < signals.demand
){

action="INCREASE_SUPPLY";

priority="MEDIUM";

reason="Demand exceeds available supply";

}



return {

action,

priority,

reason

};

}


module.exports={
select
};
