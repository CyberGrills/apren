

const express=require("express");

const router=express.Router();


const brain =
require("../marketbrain/marketReactionBrainEngine");



router.post(
"/market/pulse/:assetId",
async(req,res)=>{

try{

res.json(
await brain.analyze(
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

