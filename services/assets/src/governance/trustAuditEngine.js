const {pool}=require("../postgres");


async function record(event){


const result =
await pool.query(
`
INSERT INTO food_brain_trust_audit_events
(
user_id,
asset_id,
old_permission,
new_permission,
changed_by,
event_type
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
event.userId,
event.assetId || null,
event.oldPermission || null,
event.newPermission,
event.changedBy || event.userId,
event.eventType || "PERMISSION_CHANGE"
]
);


return result.rows[0];

}



async function history(userId){

const result =
await pool.query(
`
SELECT *

FROM food_brain_trust_audit_events

WHERE user_id=$1

ORDER BY created_at DESC
`,
[userId]
);


return result.rows;

}



module.exports={
record,
history
};
