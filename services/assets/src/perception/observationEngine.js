const {pool}=require("../postgres");


async function save(data){


const result =
await pool.query(
`
INSERT INTO food_brain_food_observations
(
asset_id,
image_reference,
video_reference,
detected_food,
freshness_score,
expiry_hours,
confidence
)

VALUES
($1,$2,$3,$4,$5,$6,$7)

RETURNING *
`,
[
data.asset_id || null,
data.image_reference || null,
data.video_reference || null,
data.detected_food,
data.freshness_score,
data.expiry_hours,
data.confidence
]
);


return result.rows[0];

}



async function history(assetId){


const result =
await pool.query(
`
SELECT *
FROM food_brain_food_observations
WHERE asset_id=$1
ORDER BY id DESC
`,
[
assetId
]
);


return result.rows;

}



module.exports={
save,
history
};
