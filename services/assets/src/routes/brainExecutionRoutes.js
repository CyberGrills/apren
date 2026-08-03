const express=require("express");

const router=express.Router();


const executionEngine =
require("../execution/autonomousExecutionEngine");



router.post("/execution/:assetId",async(req,res)=>{

try{


res.json(
await executionEngine.execute(
req.params.assetId,
req.body.decision
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

