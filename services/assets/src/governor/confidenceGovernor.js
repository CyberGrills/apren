function evaluate(votes){

const scores =
votes.map(
v=>Number(v.confidence)
);


const confidence =
Math.round(
scores.reduce(
(a,b)=>a+b,
0
)
/scores.length
);


let status="NORMAL";


if(confidence>=80){

status="HIGH_CONFIDENCE";

}
else if(confidence<50){

status="LOW_CONFIDENCE";

}


return {

confidence,

status

};

}


module.exports={evaluate};
