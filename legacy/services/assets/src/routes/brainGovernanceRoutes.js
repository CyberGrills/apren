const express=require("express");

const router=express.Router();

const governor =
require("../governance/trustGovernorEngine");



router.post("/governance/evaluate/:assetId",async(req,res)=>{

try{

res.json(
await governor.evaluate(
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


router.get("/governance/history/:assetId",async(req,res)=>{

res.json({

asset_id:req.params.assetId,

message:"Trust history ready"

});

});


module.exports=router;
