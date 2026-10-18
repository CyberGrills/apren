#!/bin/bash
set -e

echo "=== āprən Food Brain Trust Audit Security Layer 13.3 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer13-3-trust-audit

cp services/assets/src/governance/permissionMemoryEngine.js \
backups/layer13-3-trust-audit/permissionMemoryEngine.js-$(date +%Y%m%d_%H%M%S)



echo "=== Creating audit database ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_trust_audit_events
(

id SERIAL PRIMARY KEY,

user_id TEXT NOT NULL,

asset_id INTEGER,

old_permission TEXT,

new_permission TEXT,

changed_by TEXT,

event_type TEXT,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


CREATE INDEX IF NOT EXISTS idx_trust_audit_user
ON food_brain_trust_audit_events(user_id);


SQL



echo "=== Creating trust audit engine ==="

mkdir -p services/assets/src/governance



cat > services/assets/src/governance/trustAuditEngine.js <<'JS'
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
JS



echo "=== Upgrading permission memory audit ==="


cat > services/assets/src/governance/permissionMemoryEngine.js <<'JS'
const {pool}=require("../postgres");

const audit =
require("./trustAuditEngine");



async function setPermission(userId,mode){


const current =
await getPermission(userId);



const result =
await pool.query(
`
INSERT INTO food_brain_user_preferences
(
user_id,
autonomy_mode,
updated_at
)

VALUES
($1,$2,CURRENT_TIMESTAMP)

ON CONFLICT(user_id)

DO UPDATE SET

autonomy_mode=$2,

updated_at=CURRENT_TIMESTAMP

RETURNING *
`,
[
userId,
mode
]
);



await audit.record({

userId,

oldPermission:current,

newPermission:mode,

changedBy:userId,

eventType:"AUTONOMY_PERMISSION_CHANGE"

});



return result.rows[0];

}





async function getPermission(userId){


const result =
await pool.query(
`
SELECT autonomy_mode

FROM food_brain_user_preferences

WHERE user_id=$1
`,
[userId]
);



if(!result.rows.length){

return "ASSISTED";

}


return result.rows[0].autonomy_mode;

}



module.exports={
setPermission,
getPermission
};
JS




echo "=== Creating audit route ==="


cat > services/assets/src/routes/brainTrustAuditRoutes.js <<'JS'
const express=require("express");

const router=express.Router();


const audit=
require("../governance/trustAuditEngine");



router.get("/trust/audit/:userId",async(req,res)=>{


try{


res.json(
await audit.history(
req.params.userId
)
);


}

catch(error){

res.status(500).json({
error:error.message
});

}


});


module.exports=router;
JS




echo "=== Register route ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/server.js")

text=p.read_text()


if "brainTrustAuditRoutes" not in text:

    text=text.replace(
    'const brainPermissionRoutes = require("./routes/brainPermissionRoutes");',
    '''const brainPermissionRoutes = require("./routes/brainPermissionRoutes");

const brainTrustAuditRoutes = require("./routes/brainTrustAuditRoutes");'''
    )



if 'app.use("/brain", brainTrustAuditRoutes);' not in text:

    text=text.replace(
    'app.use("/brain", brainPermissionRoutes);',
    '''app.use("/brain", brainPermissionRoutes);

app.use("/brain", brainTrustAuditRoutes);'''
    )


p.write_text(text)

PY



echo "=== Testing ==="


node - <<'NODE'

require("./services/assets/src/governance/trustAuditEngine");

require("./services/assets/src/governance/permissionMemoryEngine");

console.log(
"Layer 13.3 trust audit loaded"
);

NODE


node --check services/assets/src/server.js


echo

echo "=== LAYER 13.3 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test audit history"
echo "3. commit + tag"

