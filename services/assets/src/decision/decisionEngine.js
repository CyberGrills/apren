const {pool}=require("../postgres");


const recommendation =
require("./recommendationEngine");



async function decide(assetId,data){


const decision =
recommendation.recommend(data);



const result =
await pool.query(
`
INSERT INTO food_brain_decisions
(
asset_id,
decision,
confidence,
priority
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
JSON.stringify(decision),
decision.confidence,
decision.priority
]
);



return {

asset_id:assetId,

decision,

record:result.rows[0]

};

}




async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_decisions
WHERE asset_id=$1
ORDER BY id DESC
`,
[
assetId
]
);


return result.rows;

}



module.exports={
decide,
history
};

