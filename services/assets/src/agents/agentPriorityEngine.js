
function rank(outputs){


return outputs.sort(
(a,b)=>
b.confidence-a.confidence
);


}


module.exports={
rank
};

