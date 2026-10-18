const {pool}=require("../postgres");


async function search(assetId,type){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory_nodes
WHERE asset_id=$1
AND node_type=$2
ORDER BY id DESC
`,
[
assetId,
type
]
);


return result.rows;

}



module.exports={
search
};
