
const {pool}=require("../postgres");


async function remember(data){

const result =
await pool.query(
`
INSERT INTO food_brain_strategies
(
asset_id,
strategy,
context,
confidence,
usage_count
)

VALUES
($1,$2,$3,$4,1)

RETURNING *
`,
[
data.assetId,
data.strategy,
JSON.stringify(data.context),
data.confidence
]
);


return result.rows[0];

}



module.exports={
remember
};

