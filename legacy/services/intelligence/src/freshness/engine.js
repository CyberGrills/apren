
function calculateFreshness(asset){

const now = new Date();

let score = 100;
let expiry = null;
let confidence = 80;


const category =
(asset.category || "").toLowerCase();



const perishable =
category.includes("prepared") ||
category.includes("produce") ||
category.includes("meat") ||
category.includes("fish");


if(perishable){

const created =
new Date(asset.created_at || now);


const ageHours =
(now - created) / 1000 / 60 / 60;


score = Math.max(
0,
Math.round(
100 - (ageHours / 24) * 100
)
);


expiry =
new Date(
created.getTime()+24*60*60*1000
).toISOString();


confidence=90;


}else{

score=95;

confidence=85;

}


return {

score,

confidence,

expiry,

classification:
perishable ? "PERISHABLE" : "NON_PERISHABLE"

};


}


module.exports={
calculateFreshness
};

