

const express=require("express");

const router=express.Router();


const brain =
require("../orchestrator/foodBrainOrchestrator");



router.post(
"/orchestrate/:assetId",
async(req,res)=>{


try{


res.json(
await brain.orchestrate(
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


