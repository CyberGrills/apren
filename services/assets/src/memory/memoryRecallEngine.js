const {pool}=require("../postgres");


async function recall(assetId){


const result =
await pool.query(
`
SELECT *
FROM food_brain_memory_nodes
WHERE asset_id=$1
ORDER BY created_at DESC
LIMIT 100
`,
[
assetId
]
);


return result.rows;

}



module.exports={
recall
};
