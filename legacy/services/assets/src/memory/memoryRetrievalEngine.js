
const {pool}=require("../postgres");


async function retrieve(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory
WHERE asset_id=$1
ORDER BY importance DESC
LIMIT 20
`,
[assetId]
);


return result.rows;

}


module.exports={
retrieve
};

