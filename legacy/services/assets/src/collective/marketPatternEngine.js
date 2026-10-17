
const {pool}=require("../postgres");


async function record(pattern){

const result =
await pool.query(
`
INSERT INTO food_brain_market_patterns
(
asset_id,
region,
pattern_type,
signal,
impact_score,
confidence
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
pattern.assetId,
pattern.region,
pattern.type,
pattern.signal,
pattern.impact || 0,
pattern.confidence || 0
]
);


return result.rows[0];

}


async function history(assetId){

const result =
await pool.query(
`
SELECT *

FROM food_brain_market_patterns

WHERE asset_id=$1

ORDER BY created_at DESC
`,
[assetId]
);


return result.rows;

}


module.exports={
record,
history
};

