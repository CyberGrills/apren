
const express=require("express");

const router=express.Router();


const brain =
require("../autonomy/autonomousBrainEngine");



router.post(
"/autonomous/action/:assetId",
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

