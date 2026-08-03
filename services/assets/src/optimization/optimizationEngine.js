const { pool } = require("../postgres");


async function optimize(assetId){

const feedback =
await pool.query(
`
SELECT
COUNT(*) total,
SUM(
CASE
WHEN success=true
THEN 1
ELSE 0
END
) success
FROM food_brain_feedback
WHERE asset_id=$1
`,
[assetId]
);


const row=feedback.rows[0];


const total=Number(row.total||0);
const success=Number(row.success||0);


const score =
total===0
?
50
:
Math.round((success/total)*100);


let strategy="STANDARD";


if(score>=85){

strategy="AGGRESSIVE_OPTIMIZATION";

}
else if(score<50 && total>3){

strategy="CONSERVATIVE_OPTIMIZATION";

}


const result=
await pool.query(
`
INSERT INTO food_brain_strategy_scores
(
asset_id,
strategy,
score,
sample_size
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
strategy,
score,
total
]
);


return {

asset_id:assetId,

strategy,

optimization_score:score,

sample_size:total,

record:result.rows[0]

};

}



async function history(assetId){

const result=
await pool.query(
`
SELECT *
FROM food_brain_strategy_scores
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);


return result.rows;

}


module.exports={
optimize,
history
};
