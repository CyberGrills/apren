const express = require("express");

const router = express.Router();

const autonomousDecisionEngine =
require("../decision/autonomousDecisionEngine");


router.post("/decision/:assetId", async(req,res)=>{

try{

const result =
await autonomousDecisionEngine.decide(
req.params.assetId,
req.body.simulations || []
);

res.json(result);

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


router.get("/decision/history/:assetId", async(req,res)=>{

try{

res.json({
asset_id:req.params.assetId,
message:"Decision history ready"
});

}

catch(error){

res.status(500).json({
error:error.message
});

}

});


module.exports = router;
