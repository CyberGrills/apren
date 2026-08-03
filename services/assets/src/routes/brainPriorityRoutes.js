

const express=require("express");

const router=express.Router();


const brain =
require("../priority/priorityDecisionBrain");



router.post(
"/priority/:assetId",
async(req,res)=>{

try{

res.json(
await brain.decide(
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

