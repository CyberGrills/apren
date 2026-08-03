
const express=require("express");

const router=express.Router();


const prediction =
require("../prediction/predictiveIntelligenceEngine");



const {pool}=require("../postgres");



router.post("/predict/:assetId",async(req,res)=>{

try{

res.json(
await prediction.predict(
req.params.assetId,
req.body
)
);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});





router.get("/prediction/history/:assetId",async(req,res)=>{

try{

const result =
await pool.query(
`
SELECT *

FROM food_brain_predictions

WHERE asset_id=$1

ORDER BY created_at DESC
`,
[
req.params.assetId
]
);


res.json(result.rows);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


module.exports=router;

