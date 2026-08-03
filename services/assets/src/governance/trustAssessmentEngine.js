function assess(result){


let score=50;


if(result.execution_status==="SUCCESS"){

score+=40;

}


if(result.risk==="LOW"){

score+=10;

}


return {

trust_score:Math.min(score,100)

};

}


module.exports={
assess
};
