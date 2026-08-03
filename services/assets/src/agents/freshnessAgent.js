function analyze(data){

let vote="NEUTRAL";
let confidence=50;


const freshness =
Number(data.freshness || 0);


if(freshness <= 0){

vote="BLOCK";
confidence=99;

}
else if(freshness < 30){

vote="FAST_MOVE";
confidence=85;

}
else if(freshness > 80){

vote="KEEP_ACTIVE";
confidence=80;

}


return {
agent:"FRESHNESS_AGENT",
vote,
confidence
};

}


module.exports={analyze};
