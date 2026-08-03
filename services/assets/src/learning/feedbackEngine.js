const { pool } = require("../postgres");


async function recordFeedback(data){

const result =
await pool.query(
`
INSERT INTO food_brain_feedback
(
prediction_id,
asset_id,
result,
success,
impact
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.prediction_id,
data.asset_id,
data.result,
data.success,
data.impact || null
]
);



await pool.query(
`
UPDATE food_predictions
SET resolved=true
WHERE id=$1
`,
[
data.prediction_id
]
);



return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_feedback
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
recordFeedback,
history
};
