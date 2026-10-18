const {pool}=require("../postgres");


async function remember(assetId,result){


const response =
await pool.query(
`
INSERT INTO food_brain_execution_history
(
asset_id,
action,
result
)

VALUES
($1,$2,$3)

RETURNING *
`,
[
assetId,
result.action,
JSON.stringify(result)
]
);


return response.rows[0];

}



module.exports={
remember
};

