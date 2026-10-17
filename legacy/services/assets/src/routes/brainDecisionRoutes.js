
const express=require("express");

const router=express.Router();


const decision =
require("../decision/autonomousDecisionEngine");


const memory =
require("../decision/decisionMemoryEngine");



router.post("/decision/:assetId",async(req,res)=>{

try{


res.json(
await decision.evaluate(
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




router.get("/decision/history/:assetId",async(req,res)=>{


res.json(
await memory.history(
req.params.assetId
)
);


});


module.exports=router;

