
const {pool}=require("../postgres");


async function record(data){

const result =
await pool.query(
`
INSERT INTO food_brain_market_signals
(
asset_id,
signal_type,
signal_data,
impact
)

VALUES($1,$2,$3,$4)

RETURNING *
`,
[
data.assetId,
data.signal,
JSON.stringify(data.context),
data.impact
]
);


return result.rows[0];

}


module.exports={
record
};

