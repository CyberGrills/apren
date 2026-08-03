const { pool } = require("../postgres");


async function loadRules(){

const result =
await pool.query(
`
SELECT *
FROM economy_rules
WHERE active=true
ORDER BY priority DESC
`
);

return result.rows;

}



function evaluateCondition(rule,context){

switch(rule.condition_type){


case "FRESHNESS_BELOW":

return Number(context.freshness)
<
Number(rule.threshold);



case "FRESHNESS_ZERO":

return Number(context.freshness) <= 0;



case "TRUST_BELOW":

return Number(context.trust)
<
Number(rule.threshold);



case "DEMAND_HIGH":

return Number(context.demand)
>
Number(rule.threshold);



case "SUPPLY_LOW":

return Number(context.supply)
<
Number(rule.threshold);



default:

return false;

}

}



async function evaluate(context){

const rules =
await loadRules();


const results=[];


for(const rule of rules){

const triggered =
evaluateCondition(
rule,
context
);


if(triggered){

results.push({

rule:rule.name,

action:rule.action,

message:rule.description

});

}

}


return {

allowed:
!results.some(
r=>r.action==="BLOCK"
),

warnings:
results.filter(
r=>r.action==="WARN"
),

actions:
results

};

}



module.exports={
evaluate
};
