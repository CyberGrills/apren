
const {pool}=require("../postgres");


async function remember(assetId,data){

await pool.query(
`
INSERT INTO food_brain_memory
(
asset_id,
memory_type,
event,
decision,
outcome,
confidence,
importance
)

VALUES($1,$2,$3,$4,$5,$6,$7)
`,
[
assetId,
data.type || "EVENT",
JSON.stringify(data.event || {}),
JSON.stringify(data.decision || {}),
JSON.stringify(data.outcome || {}),
data.confidence || 0,
data.importance || 0
]
);


return {
stored:true
};

}


module.exports={
remember
};

