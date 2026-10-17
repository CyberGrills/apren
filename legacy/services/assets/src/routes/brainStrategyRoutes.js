

const express=require("express");

const router=express.Router();


const brain =
require("../strategy/autonomousStrategyBrain");


router.post(
"/strategy/:assetId",
async(req,res)=>{

try{

res.json(
await brain.generate(
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

