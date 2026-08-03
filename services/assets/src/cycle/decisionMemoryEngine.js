
const {pool}=require("../postgres");


async function remember(assetId,stage,input,decision,confidence){

await pool.query(
`
INSERT INTO food_brain_decision_cycles
(
asset_id,
cycle_stage,
input_state,
decision,
confidence
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
stage,
JSON.stringify(input),
JSON.stringify(decision),
confidence
]
);

}


module.exports={
remember
};

