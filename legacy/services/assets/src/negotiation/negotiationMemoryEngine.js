
const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_negotiation_cycles
(
asset_id,
arguments,
winner_strategy,
confidence
)

VALUES($1,$2,$3,$4)

RETURNING *
`,
[
data.assetId,
JSON.stringify(data.arguments),
data.decision,
data.confidence
]
);


return result.rows[0];

}


module.exports={
remember
};

