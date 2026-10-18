

const {pool}=require("../postgres");


async function record(data){


await pool.query(
`
INSERT INTO food_brain_strategy_outcomes
(
asset_id,
strategy_type,
expected_result,
actual_result,
success_score,
learning_notes
)

VALUES($1,$2,$3,$4,$5,$6)
`,
[
data.assetId,
data.strategy,
JSON.stringify(data.expected),
JSON.stringify(data.actual),
data.score,
JSON.stringify(data.notes || {})
]
);


return true;

}


module.exports={
record
};

