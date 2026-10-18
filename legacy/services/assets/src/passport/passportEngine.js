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
