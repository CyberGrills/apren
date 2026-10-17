const {pool}=require("../postgres");


const future =
require("./futureStateEngine");



async function predict(assetId,data){


const prediction =
future.calculate(data);



const result =
await pool.query(
`
INSERT INTO food_brain_predictions
(
asset_id,
prediction,
recommendation
)

VALUES
($1,$2,$3)

RETURNING *
`,
[
assetId,
JSON.stringify(prediction),
prediction.recommendation
]
);



return {

asset_id:assetId,

prediction,

record:result.rows[0]

};

}





async function history(assetId){

const result =
await pool.query(
`
SELECT *
FROM food_brain_predictions
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

