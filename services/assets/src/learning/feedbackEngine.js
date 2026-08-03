const {pool}=require("../postgres");


async function record(data){

const result =
await pool.query(
`
INSERT INTO food_brain_learning_feedback
(
asset_id,
engine,
prediction,
actual_result,
accuracy,
error_score
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.asset_id,
data.engine,
JSON.stringify(data.prediction || {}),
JSON.stringify(data.actual_result || {}),
data.accuracy || 0,
data.error_score || 0
]
);


return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_learning_feedback
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
record,
history
};
