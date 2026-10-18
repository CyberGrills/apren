
const {pool}=require("../postgres");


async function record(data){

const result =
await pool.query(
`
INSERT INTO food_brain_events
(
asset_id,
event_type,
event_data,
impact
)

VALUES($1,$2,$3,$4)

RETURNING *
`,
[
data.assetId,
data.type,
JSON.stringify(data.data),
data.impact
]
);


return result.rows[0];

}


module.exports={
record
};

