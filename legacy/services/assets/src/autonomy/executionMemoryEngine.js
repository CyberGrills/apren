
const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_action_history
(
asset_id,
action,
result,
success_score
)

VALUES($1,$2,$3,$4)

RETURNING *
`,
[
data.assetId,
data.action,
JSON.stringify(data.result),
data.score
]
);


return result.rows[0];

}



module.exports={
remember
};

