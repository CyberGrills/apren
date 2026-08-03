const { pool } = require("../postgres");


async function calculate(assetId){


const result =
await pool.query(
`
SELECT
COUNT(*) total,
SUM(
CASE
WHEN success=true
THEN 1
ELSE 0
END
) successful
FROM food_brain_feedback
WHERE asset_id=$1
`,
[
assetId
]
);



const row =
result.rows[0];


const total =
Number(row.total || 0);


const successful =
Number(row.successful || 0);



const accuracy =
total===0
?
0
:
Math.round(
(successful / total) * 100
);



await pool.query(
`
INSERT INTO food_brain_accuracy
(
asset_id,
accuracy_score,
sample_size
)

VALUES
($1,$2,$3)
`,
[
assetId,
accuracy,
total
]
);



return {

asset_id:assetId,

accuracy_score:accuracy,

sample_size:total

};


}



module.exports={
calculate
};
