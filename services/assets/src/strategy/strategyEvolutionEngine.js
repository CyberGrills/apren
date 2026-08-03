
const scoreEngine =
require("./strategyScoreEngine");

const ranking =
require("./strategyRankingEngine");

const memory =
require("./strategyMemoryEngine");



async function evolve(assetId,data){


const score =
scoreEngine.score(
data.result
);



const strategies=[

{
strategy:data.previousStrategy,
score
},

{
strategy:"PROMOTE",
score:score + 5
},

{
strategy:"TRADE",
score:score + 3
},

{
strategy:"HOLD",
score:score - 10
}

];



const ranked =
ranking.rank(strategies);



const best =
ranked[0];



return await memory.remember({

assetId,

strategy:
best.strategy,

context:{
previous:data.previousStrategy,
result:data.result,
ranking:ranked
},

confidence:
best.score

});


}



module.exports={
evolve
};

