function generateRecommendation(data){

const freshness =
Number(data.freshness || 0);

const demand =
Number(data.demand || 0);

const trust =
Number(data.trust || 0);


let action="MONITOR";

let reason="Asset conditions stable";


if(freshness <= 0){

action="BLOCK_TRADE";

reason="Food expired and cannot continue trading";

}

else if(freshness < 30 && demand > 70){

action="FAST_MOVE";

reason="High demand but freshness is declining";

}

else if(freshness < 40){

action="DISCOUNT";

reason="Freshness decline requires faster movement";

}

else if(demand > 80 && freshness > 80){

action="PROMOTE";

reason="High demand and strong freshness";

}

else if(trust < 30){

action="REVIEW_TRUST";

reason="Asset trust requires verification";

}



return {

action,

reason,

confidence:
Math.min(
99,
Math.round(
(
freshness +
demand +
trust
) / 3
)
)

};

}


module.exports={
generateRecommendation
};
