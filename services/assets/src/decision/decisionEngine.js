
const ranking =
require("./actionRankingEngine");

const reasoning =
require("./reasoningEngine");



function decide(data){


let actions=[

{
action:"HOLD",
score:40
},

{
action:"PROMOTE",
score:60
},

{
action:"SELL_NOW",
score:50
},

{
action:"TRADE",
score:45
}

];



if(data.freshness < 40){

actions.find(
x=>x.action==="SELL_NOW"
).score += 40;

}



if(data.demand==="HIGH"){

actions.find(
x=>x.action==="PROMOTE"
).score += 30;

}



const ranked =
ranking.rank(actions);



return {

action:
ranked[0].action,

confidence:
Math.min(
95,
ranked[0].score
),

reasoning:
reasoning.explain(data)

};

}



module.exports={
decide
};

