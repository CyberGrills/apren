
const {pool}=require("../postgres");


async function connect(data){

const result =
await pool.query(
`
INSERT INTO food_brain_graph_edges
(
source_node,
target_node,
relationship,
relationship_data,
strength
)

VALUES($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.source,
data.target,
data.relationship,
JSON.stringify(data.data),
data.strength
]
);


return result.rows[0];

}


module.exports={
connect
};

