const {pool}=require("../postgres");


async function broadcast(data){

const result =
await pool.query(
`
INSERT INTO food_brain_agent_messages
(
agent,
message,
confidence,
payload
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.agent,
data.message,
data.confidence || 0,
JSON.stringify(data.payload || {})
]
);


return result.rows[0];

}



async function history(){

const result =
await pool.query(
`
SELECT *
FROM food_brain_agent_messages
ORDER BY id DESC
LIMIT 100
`
);


return result.rows;

}



module.exports={
broadcast,
history
};
