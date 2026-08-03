const {pool}=require("../postgres");


async function record(data){


const result =
await pool.query(
`
INSERT INTO food_brain_economic_events
(
asset_id,
event_type,
value,
details
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
data.asset_id,
data.event_type,
data.value || null,
JSON.stringify(data.details || {})
]
);


return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_economic_events
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);


return result.rows;

}



module.exports={
record,
history
};
