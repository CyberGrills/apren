
const {pool}=require("../postgres");


async function record(data){


const result =
await pool.query(
`
INSERT INTO food_brain_learning_feedback
(
asset_id,
source_stage,
feedback_type,
feedback_data,
learning_score
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.stage,
data.type,
JSON.stringify(data.data),
data.score
]
);


return result.rows[0];

}


module.exports={
record
};

