

const {pool}=require("../postgres");


async function feedback(assetId,data){


await pool.query(
`
INSERT INTO food_brain_decision_feedback
(
asset_id,
expected_outcome,
actual_outcome,
accuracy_score,
improvement_signal
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
JSON.stringify(data.expected),
JSON.stringify(data.actual),
data.score || 0,
JSON.stringify(data.signal || {})
]
);


return {

status:"FEEDBACK_RECORDED",

accuracy:data.score || 0

};


}


module.exports={
feedback
};


