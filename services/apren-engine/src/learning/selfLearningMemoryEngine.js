
const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_learning_models
(
asset_id,
model_type,
model_state,
accuracy,
confidence
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.type,
JSON.stringify(data.state),
data.accuracy,
data.confidence
]
);


return result.rows[0];

}


module.exports={
remember
};

