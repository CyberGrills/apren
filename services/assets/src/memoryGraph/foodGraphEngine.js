const {pool}=require("../postgres");


async function createNode(data){

const result =
await pool.query(
`
INSERT INTO food_brain_memory_nodes
(
asset_id,
node_type,
node_name,
metadata
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.asset_id || null,
data.node_type,
data.node_name,
JSON.stringify(data.metadata || {})
]
);


return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory_nodes
WHERE asset_id=$1
ORDER BY id DESC
`,
[
assetId
]
);


return result.rows;

}



module.exports={
createNode,
history
};
