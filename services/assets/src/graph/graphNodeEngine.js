
const {pool}=require("../postgres");


async function createNode(data){

const result =
await pool.query(
`
INSERT INTO food_brain_graph_nodes
(
asset_id,
node_type,
node_name,
node_data,
importance
)

VALUES($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.type,
data.name,
JSON.stringify(data.data),
data.importance
]
);


return result.rows[0];

}


module.exports={
createNode
};

