const {pool}=require("../postgres");


const freshness =
require("./freshnessAgent");

const market =
require("./marketAgent");

const trust =
require("./trustAgent");



async function decide(assetId){


const asset =
await pool.query(
`
SELECT *
FROM food_assets
WHERE id=$1
`,
[assetId]
);


if(!asset.rows[0]){

throw new Error("Asset not found");

}


const item=asset.rows[0];


const context={

freshness:item.freshness_score,

demand:item.demand_score,

trust:item.trust_score

};



const votes=[

freshness.analyze(context),

market.analyze(context),

trust.analyze(context)

];



let finalDecision="MONITOR";



if(
votes.some(
v=>v.vote==="BLOCK"
)
){

finalDecision="BLOCK_TRADE";

}

else if(
votes.some(
v=>v.vote==="FAST_MOVE"
)
){

finalDecision="FAST_MOVE";

}

else if(
votes.some(
v=>v.vote==="PROMOTE"
)
){

finalDecision="PROMOTE";

}



const confidence =
Math.round(
votes.reduce(
(a,b)=>a+b.confidence,
0
)
/ votes.length
);



const result =
await pool.query(
`
INSERT INTO food_brain_council_decisions
(
asset_id,
decision,
votes,
confidence
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
finalDecision,
JSON.stringify(votes),
confidence
]
);



return {

asset_id:assetId,

decision:finalDecision,

confidence,

votes,

record:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_council_decisions
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);

return result.rows;

}



module.exports={
decide,
history
};
