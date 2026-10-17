const {pool}=require("../postgres");


async function evaluate(assetId){

const result = await pool.query(
`
SELECT *
FROM food_brain_learning_feedback
WHERE asset_id=$1
ORDER BY created_at DESC
LIMIT 50
`,
[assetId]
);


let accuracy=0;
let samples=result.rows.length;


if(samples){

let total=0;

for(const row of result.rows){

total += Number(row.accuracy || 0);

}

accuracy = Math.round(total / samples);

}


let adaptation="STABLE";


if(accuracy < 60){

adaptation="IMPROVE_MODEL";

}
else if(accuracy > 90){

adaptation="HIGH_CONFIDENCE";

}


return {

asset_id:assetId,

samples,

accuracy,

adaptation

};

}



module.exports={
evaluate
};
