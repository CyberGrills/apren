
const {pool}=require("../postgres");


async function remember(type,key,value,confidence){

const result =
await pool.query(
`
INSERT INTO food_brain_collective_memory
(
memory_type,
memory_key,
memory_value,
confidence
)

VALUES
($1,$2,$3,$4)

ON CONFLICT(memory_key)

DO UPDATE SET

memory_value=$3,

confidence=$4

RETURNING *
`,
[
type,
key,
JSON.stringify(value),
confidence || 0
]
);


return result.rows[0];

}


async function recall(key){

const result =
await pool.query(
`
SELECT *

FROM food_brain_collective_memory

WHERE memory_key=$1
`,
[key]
);


return result.rows[0] || null;

}


module.exports={
remember,
recall
};

