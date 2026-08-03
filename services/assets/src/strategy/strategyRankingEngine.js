
function rank(strategies){


return strategies.sort(
(a,b)=>
b.score-a.score
);


}



module.exports={
rank
};

