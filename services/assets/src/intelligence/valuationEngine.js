function calculateValue(data){

const base =
Number(data.current_value || 0);


const freshness =
Number(data.freshness || 0) / 100;


const demand =
Number(data.demand || 0) / 100;


const trust =
Number(data.trust || 0) / 100;



const multiplier =
(
0.5 * freshness +
0.3 * demand +
0.2 * trust
);



return {

base_value:base,

valuation_multiplier:
Number(multiplier.toFixed(3)),

estimated_value:
Number(
(base * (1 + multiplier))
.toFixed(2)
)

};


}


module.exports={
calculateValue
};
