#!/bin/bash
set -e

echo "=== āprən Food Brain Persistent Trust Identity Layer 13.2 ==="

cd ~/apren


echo "=== Backup ==="

mkdir -p backups/layer13-2-persistent-trust

cp services/assets/src/governance/permissionMemoryEngine.js \
backups/layer13-2-persistent-trust/permissionMemoryEngine.js-$(date +%Y%m%d_%H%M%S)



echo "=== Creating trust preference database ==="


docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_brain_user_preferences
(

id SERIAL PRIMARY KEY,

user_id TEXT UNIQUE NOT NULL,

autonomy_mode TEXT DEFAULT 'ASSISTED',

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);


CREATE INDEX IF NOT EXISTS idx_brain_user_preferences
ON food_brain_user_preferences(user_id);


SQL




echo "=== Upgrading permission memory ==="


cat > services/assets/src/governance/permissionMemoryEngine.js <<'JS'
const {pool}=require("../postgres");



async function setPermission(userId,mode){


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
[
userId
]
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




echo "=== Updating trust governor async support ==="


python3 <<'PY'

from pathlib import Path

p=Path("services/assets/src/governance/trustGovernorEngine.js")

text=p.read_text()


text=text.replace(
'const userPermission =\npermission.getPermission(\n data.userId || "default"\n);',
'''const userPermission =
await permission.getPermission(
data.userId || "default"
);'''
)


text=text.replace(
'permission.getPermission(\nreq.params.userId\n)',
'''await permission.getPermission(
req.params.userId
)'''
)


p.write_text(text)

PY



node --check services/assets/src/governance/permissionMemoryEngine.js

node --check services/assets/src/governance/trustGovernorEngine.js



echo "=== Testing persistence module ==="


node - <<'NODE'

const permission =
require("./services/assets/src/governance/permissionMemoryEngine");


(async()=>{

await permission.setPermission(
"test-user",
"AUTONOMOUS"
);


console.log(
await permission.getPermission(
"test-user"
)
);


})();

NODE



echo

echo "=== LAYER 13.2 COMPLETE ==="

echo "Next:"
echo "1. restart assets"
echo "2. test persistent permission"
echo "3. commit + tag"

