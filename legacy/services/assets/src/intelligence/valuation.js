
function calculateValue({

basePrice=10,
freshness=100,
demand=0,
trust=50,
scarcity=1

}){


const freshnessFactor =
freshness / 100;


const demandFactor =
1 + (demand / 100);


const trustFactor =
1 + ((trust-50)/100);


return Number(
(
basePrice *
freshnessFactor *
demandFactor *
trustFactor *
scarcity
)
.toFixed(2)
);

}


module.exports={
calculateValue
};

