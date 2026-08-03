const { pool } = require("../postgres");


async function storeMemory(data){

const result =
await pool.query(
`
INSERT INTO food_brain_memory
(
asset_id,
event_type,
input_data,
decision,
outcome,
accuracy_score
)

VALUES
($1,$2,$3,$4,$5,$6)

RETURNING *
`,
[
data.asset_id,
data.event_type,
JSON.stringify(data.input_data || {}),
data.decision,
data.outcome || null,
data.accuracy_score || null
]
);


return result.rows[0];

}



async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_memory
WHERE asset_id=$1
ORDER BY id DESC
`,
[
assetId
]
);


return result.rows;

}



async function learn(assetId){

const memories =
await history(assetId);



let successful=0;
let total=memories.length;


for(const item of memories){

if(
item.accuracy_score &&
Number(item.accuracy_score)>=80
){

successful++;

}

}



const learningScore =
total === 0
?
0
:
Math.round(
(successful / total) * 100
);



return {

asset_id:assetId,

memory_events:total,

learning_score:learningScore,

confidence:
Math.min(
99,
50 + learningScore / 2
)

};


}



module.exports={
storeMemory,
history,
learn
};
