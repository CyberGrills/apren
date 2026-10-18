const { pool } = require("../postgres");


async function evolve(assetId){

const strategies =
await pool.query(
`
SELECT *
FROM food_brain_strategy_scores
WHERE asset_id=$1
ORDER BY score DESC
LIMIT 5
`,
[assetId]
);


let best="NONE";

let confidence=0;


if(strategies.rows.length){

best=strategies.rows[0].strategy;

confidence=
Number(strategies.rows[0].score);

}


const result=
await pool.query(
`
INSERT INTO food_brain_rule_evolution
(
asset_id,
best_strategy,
confidence
)

VALUES
($1,$2,$3)

RETURNING *
`,
[
assetId,
best,
confidence
]
);


return {

asset_id:assetId,

best_strategy:best,

confidence,

record:result.rows[0]

};

}



async function history(assetId){

const result=
await pool.query(
`
SELECT *
FROM food_brain_rule_evolution
WHERE asset_id=$1
ORDER BY id DESC
`,
[assetId]
);

return result.rows;

}


module.exports={
evolve,
history
};
