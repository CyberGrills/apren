
function evaluate(result){

if(result.success){

return {
score:90,
state:"SUCCESS"
};

}


return {
score:40,
state:"FAILED"
};

}


module.exports={
evaluate
};

