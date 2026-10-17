
const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_market_simulations
(
asset_id,
scenario,
input_data,
predicted_outcome,
confidence
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *
`,
[
data.assetId,
data.scenario,
JSON.stringify(data.input),
JSON.stringify(data.output),
data.confidence
]
);


return result.rows[0];

}


module.exports={
remember
};

