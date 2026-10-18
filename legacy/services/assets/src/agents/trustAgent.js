function analyze(data){

let vote="TRUSTED";
let confidence=70;


const trust =
Number(data.trust || 0);


if(trust < 30){

vote="REVIEW";
confidence=90;

}


return {
agent:"TRUST_AGENT",
vote,
confidence
};

}


module.exports={analyze};
