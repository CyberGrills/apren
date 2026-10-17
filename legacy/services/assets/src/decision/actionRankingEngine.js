
function rank(actions){


return actions.sort(
(a,b)=>b.score-a.score
);


}


module.exports={
rank
};

