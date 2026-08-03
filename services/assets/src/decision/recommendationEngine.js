const action =
require("./actionSelector");


const confidence =
require("./confidenceDecisionEngine");



function recommend(data){


const decision =
action.select(data);



const score =
confidence.calculate(data);



return {

action:
decision.action,

priority:
decision.priority,

reason:
decision.reason,

confidence:
score

};

}



module.exports={
recommend
};
