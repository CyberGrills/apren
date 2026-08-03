

const express=require("express");

const router=express.Router();


const brain =
require("../cycle/brainCycleController");

const feedback =
require("../cycle/cycleFeedbackEngine");



router.post(
"/cycle/:assetId",
async(req,res)=>{

try{

res.json(
await brain.execute(
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



router.post(
"/cycle-feedback/:assetId",
async(req,res)=>{

try{

res.json(
await feedback.feedback(
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


