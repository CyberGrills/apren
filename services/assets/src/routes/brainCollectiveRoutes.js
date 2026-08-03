
const express=require("express");

const router=express.Router();


const intelligence =
require("../collective/collectiveIntelligenceEngine");



router.post("/collective/analyze/:assetId",async(req,res)=>{

try{

res.json(
await intelligence.analyze(
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

