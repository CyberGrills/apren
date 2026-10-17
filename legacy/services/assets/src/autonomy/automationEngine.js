const { pool } = require("../postgres");

const guard =
require("./executionGuard");



async function execute(actionId){


const action =
await pool.query(
`
SELECT *
FROM food_brain_actions_queue
WHERE id=$1
`,
[
actionId
]
);



if(!action.rows[0]){

throw new Error("Action not found");

}



const item =
action.rows[0];



const permission =
guard.validate(
item.action
);



let status =
permission.allowed
?
"EXECUTED"
:
"BLOCKED";



await pool.query(
`
UPDATE food_brain_actions_queue
SET status=$1
WHERE id=$2
`,
[
status,
actionId
]
);



const log =
await pool.query(
`
INSERT INTO food_brain_execution_log
(
action_id,
asset_id,
result,
impact
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
actionId,
item.asset_id,
status,
permission.reason
]
);



return log.rows[0];

}



module.exports={
execute
};
