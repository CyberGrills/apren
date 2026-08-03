const {pool}=require("../postgres");


async function connect(data){

const result =
await pool.query(
`
INSERT INTO food_brain_memory_relationships
(
from_node,
to_node,
relationship,
strength
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.from_node,
data.to_node,
data.relationship,
data.strength || 50
]
);


return result.rows[0];

}



async function graph(node){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory_relationships
WHERE from_node=$1
OR to_node=$1
ORDER BY id DESC
`,
[
node
]
);


return result.rows;

}



module.exports={
connect,
graph
};
