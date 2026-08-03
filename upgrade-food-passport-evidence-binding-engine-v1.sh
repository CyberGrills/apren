#!/bin/bash
set -e

echo "=== āprən Food Passport Evidence Binding Engine v1 ==="

cd ~/apren


echo "=== Backup assets service ==="

mkdir -p backups/food-passport-v1

cp -r services/assets/src \
backups/food-passport-v1/src-$(date +%Y%m%d_%H%M%S)


echo "=== Creating passport intelligence module ==="

mkdir -p services/assets/src/passport


cat > services/assets/src/passport/passportEngine.js <<'JS'
const { pool } = require("../postgres");


async function createPassport(data){

const result =
await pool.query(
`
INSERT INTO food_passports
(
asset_id,
passport_code,
origin,
verification_status,
trust_score
)

VALUES
($1,$2,$3,'VERIFIED',$4)

RETURNING *
`,
[
data.asset_id,
data.passport_code || `APR-${Date.now()}`,
data.origin || "UNKNOWN",
data.trust_score || 50
]
);


return result.rows[0];

}



async function getPassport(assetId){

const passport =
await pool.query(
`
SELECT *
FROM food_passports
WHERE asset_id=$1
`,
[assetId]
);


const evidence =
await pool.query(
`
SELECT *
FROM food_evidence
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);


return {

passport:passport.rows[0] || null,

evidence:evidence.rows

};


}



module.exports={
createPassport,
getPassport
};
JS



echo "=== Creating database tables ==="

docker exec -i apren-postgres psql \
-U apren \
-d apren <<'SQL'


CREATE TABLE IF NOT EXISTS food_passports
(
id SERIAL PRIMARY KEY,

asset_id INTEGER REFERENCES food_assets(id)
ON DELETE CASCADE,

passport_code TEXT UNIQUE,

origin TEXT,

verification_status TEXT,

trust_score NUMERIC(5,2),

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



ALTER TABLE food_evidence
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'PENDING';



CREATE INDEX IF NOT EXISTS idx_food_passport_asset
ON food_passports(asset_id);


SQL



echo "=== Adding passport routes ==="


python3 <<'PY'
from pathlib import Path

path=Path("services/assets/src/server.js")

text=path.read_text()


if "passportEngine" not in text:

    text=text.replace(
    'const foodEvidenceEngine',
    'const passportEngine = require("./passport/passportEngine");\n\nconst foodEvidenceEngine'
    )


routes="""

app.post("/food/passport/create", async(req,res)=>{

try{

const result =
await passportEngine.createPassport(req.body);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


app.get("/food/passport/:assetId", async(req,res)=>{

try{

const result =
await passportEngine.getPassport(
req.params.assetId
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


"""


if "/food/passport/create" not in text:

    insert=text.find("app.listen")

    text=text[:insert]+routes+text[insert:]


path.write_text(text)

PY



echo "=== Testing passport module ==="

node - <<'NODE'
require("./services/assets/src/passport/passportEngine");
console.log("Food passport engine loaded");
NODE


echo
echo "=== COMPLETE ==="

echo "Next:"
echo "1. node --check services/assets/src/server.js"
echo "2. restart assets service"
echo "3. create passport"

