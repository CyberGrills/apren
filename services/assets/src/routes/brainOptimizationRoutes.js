

const express=require("express");

const router=express.Router();


const brain =
require("../optimization/selfOptimizationBrain");



router.post(
"/optimize/:assetId",
async(req,res)=>{

try{

res.json(
await brain.optimize(
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


module.exports=router;

