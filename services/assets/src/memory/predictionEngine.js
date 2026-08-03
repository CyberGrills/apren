const { pool } = require("../postgres");


async function predict(assetId){


const memories =
await pool.query(
`
SELECT *
FROM food_brain_memory
WHERE asset_id=$1
ORDER BY id DESC
LIMIT 20
`,
[
assetId
]
);



let risk="LOW";

let confidence=50;



if(memories.rows.length > 5){

confidence=70;

}



const expiring =
memories.rows.filter(
m =>
String(m.event_type)
.includes("EXPIR")
);



if(expiring.length>2){

risk="HIGH";

confidence=85;

}



const prediction =
risk==="HIGH"
?
"Move asset before freshness loss"
:
"Asset conditions stable";



const result =
await pool.query(
`
INSERT INTO food_predictions
(
asset_id,
prediction,
expected_result,
confidence
)

VALUES
($1,$2,$3,$4)

RETURNING *
`,
[
assetId,
prediction,
risk,
confidence
]
);



return {

prediction,

risk,

confidence,

record:result.rows[0]

};


}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_predictions
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
predict,
history
};
