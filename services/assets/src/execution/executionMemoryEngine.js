
const {pool}=require("../postgres");


async function plan(data){


const result =
await pool.query(
`
INSERT INTO food_brain_action_plans
(
asset_id,
decision_id,
action,
execution_mode,
requirements
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.decisionId || null,
data.action,
data.mode,
JSON.stringify(data.requirements)
]
);


return result.rows[0];

}





async function result(data){


const output =
await pool.query(
`
INSERT INTO food_brain_execution_results
(
plan_id,
result_status,
execution_output,
learning_signal
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.planId,
data.status,
JSON.stringify(data.output),
data.signal
]
);


return output.rows[0];

}



module.exports={
plan,
result
};

