
const {pool}=require("../postgres");


async function learn(data){


await pool.query(
`
INSERT INTO food_brain_learning_feedback
(
asset_id,
previous_action,
result,
learning_score
)

VALUES($1,$2,$3,$4)
`,
[
data.assetId,
data.action,
JSON.stringify(data.result),
data.score
]
);


return true;

}



module.exports={
learn
};

