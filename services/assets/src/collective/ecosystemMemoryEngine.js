
const {pool}=require("../postgres");


async function remember(event){

const result =
await pool.query(
`
INSERT INTO food_brain_ecosystem_events
(
asset_id,
event_type,
source,
event_data
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
event.assetId,
event.type,
event.source,
JSON.stringify(event.data || {})
]
);


return result.rows[0];

}


module.exports={
remember
};

