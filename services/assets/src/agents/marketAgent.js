function analyze(data){

let vote="NEUTRAL";
let confidence=50;


const demand =
Number(data.demand || 0);


if(demand > 80){

vote="PROMOTE";
confidence=85;

}
else if(demand < 30){

vote="DISCOUNT";
confidence=70;

}


return {
agent:"MARKET_AGENT",
vote,
confidence
};

}


module.exports={analyze};
