
function debate(argumentsList){


return argumentsList.sort(
(a,b)=>
b.score-a.score
);


}


module.exports={
debate
};

