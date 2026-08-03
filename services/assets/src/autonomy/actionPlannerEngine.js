
const priority =
require("./actionPriorityEngine");


function plan(data){


const score =
priority.calculate(data);


let action="MONITOR";


let reasons=[];



if(data.freshness < 30){

action="DISTRIBUTE_FAST";

reasons.push(
"freshness decay risk"
);

}



if(data.demand==="HIGH"){

reasons.push(
"high demand opportunity"
);

}



if(data.supply==="LOW"){

reasons.push(
"supply pressure"
);

}



return {

action,

priority:score,

reasoning:reasons,

confidence:score,

requiresApproval:true

};


}



module.exports={
plan
};

