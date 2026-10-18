function calculateFreshness(data){

const now = Date.now();

const uploaded =
new Date(data.uploaded_at).getTime();


const hoursPassed =
(now - uploaded) /
(1000 * 60 * 60);



let freshness;


if(data.perishable === false){

freshness = 100;

}
else{

freshness =
Math.max(
0,
100 - (hoursPassed / 24) * 100
);

}



let status;


if(freshness >= 80){

status="FRESH";

}
else if(freshness >= 40){

status="AGING";

}
else if(freshness > 0){

status="EXPIRING";

}
else{

status="EXPIRED";

}



return {

freshness_score:
Number(freshness.toFixed(2)),

status,

remaining_hours:
Math.max(
0,
24 - hoursPassed
)

};


}


module.exports={
calculateFreshness
};
