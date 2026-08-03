const {pool}=require("../postgres");


async function collect(assetId){


const result =
await pool.query(
`
SELECT *
FROM (

SELECT
'prediction' AS source,
prediction AS data,
created_at
FROM food_brain_predictions
WHERE asset_id=$1


UNION ALL


SELECT
'learning' AS source,
jsonb_build_object(
'accuracy',accuracy,
'error_score',error_score,
'prediction',prediction,
'actual_result',actual_result
) AS data,
created_at
FROM food_brain_learning_feedback
WHERE asset_id=$1


UNION ALL


SELECT
'decision' AS source,
decision AS data,
created_at
FROM food_brain_decisions
WHERE asset_id=$1


UNION ALL


SELECT
'governor' AS source,
signals AS data,
created_at
FROM food_brain_governor_decisions
WHERE asset_id=$1

) memory

ORDER BY created_at DESC

`,
[
assetId
]
);


return result.rows;

}


module.exports={
collect
};
