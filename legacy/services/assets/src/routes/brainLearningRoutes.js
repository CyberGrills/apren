
const express=require("express");

const router=express.Router();


const learning =
require("../learning/selfLearningEngine");



router.post("/learn/:assetId",async(req,res)=>{


try{

res.json(
await learning.learn(
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

