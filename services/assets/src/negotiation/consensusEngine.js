
function decide(argumentsList){


const winner =
argumentsList[0];


return {

decision:winner.position,

winning_agent:winner.agent,

confidence:winner.score

};


}



module.exports={
decide
};

