

function coordinate(
market,
negotiation,
action
){


return {

decision:
action?.autonomous_plan?.action
||
negotiation?.consensus?.decision
||
market?.market_prediction?.prediction
||
"MONITOR",


confidence:
action?.autonomous_plan?.confidence
||
negotiation?.consensus?.confidence
||
market?.market_prediction?.confidence
||
50

};


}



module.exports={
coordinate
};

