

const express=require("express");

const router=express.Router();


const brain =
require("../agents/agentCollaborationEngine");



router.post(
"/agents/:assetId",
async(req,res)=>{

try{

res.json(
await brain.collaborate(
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


