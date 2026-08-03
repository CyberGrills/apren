
const {pool}=require("../postgres");



async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_learning_memory
(
asset_id,
decision,
execution_result,
outcome_status,
confidence_before,
confidence_after,
learning_signal
)

VALUES
($1,$2,$3,$4,$5,$6,$7)

RETURNING *
`,
[
data.assetId,
data.decision,
JSON.stringify(data.result),
data.status,
data.confidenceBefore,
data.confidenceAfter,
data.signal
]
);


return result.rows[0];

}





async function history(assetId){


const result =
await pool.query(
`
SELECT *

FROM food_brain_learning_memory

WHERE asset_id=$1

ORDER BY created_at DESC
`,
[
assetId
]
);


return result.rows;

}



module.exports={
remember,
history
};

