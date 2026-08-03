
const {pool}=require("../postgres");


async function remember(data){

const result =
await pool.query(
`
INSERT INTO food_brain_future_scenarios
(
asset_id,
scenario_name,
future_state,
predicted_value,
risk_level,
confidence
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.assetId,
data.name,
JSON.stringify(data.state),
data.value,
data.risk,
data.confidence
]
);


return result.rows[0];

}


module.exports={
remember
};

