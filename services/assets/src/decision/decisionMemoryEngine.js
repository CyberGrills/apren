
const {pool}=require("../postgres");


async function remember(data){


const result =
await pool.query(
`
INSERT INTO food_brain_decisions
(
asset_id,
action,
reasoning,
signals,
confidence,
execution_mode
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.assetId,
data.action,
JSON.stringify(data.reasoning),
JSON.stringify(data.signals),
data.confidence,
data.mode
]
);


return result.rows[0];

}


async function history(assetId){


const result =
await pool.query(
`
SELECT *

FROM food_brain_decisions

WHERE asset_id=$1

ORDER BY created_at DESC
`,
[
assetId
]
);


return result.rows;

}


module.exports={
remember,
history
};

