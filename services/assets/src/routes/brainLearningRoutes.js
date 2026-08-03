
const express=require("express");

const router=express.Router();


const learning =
require("../learning/selfLearningEngine");


const memory =
require("../learning/learningMemoryEngine");



router.post("/learning/outcome/:assetId",async(req,res)=>{

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




router.get("/learning/history/:assetId",async(req,res)=>{


res.json(
await memory.history(
req.params.assetId
)
);


});



module.exports=router;

