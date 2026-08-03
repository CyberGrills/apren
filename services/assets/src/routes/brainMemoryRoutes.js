
const express=require("express");

const router=express.Router();


const brain =
require("../memory/memoryFusionBrainEngine");


router.post(
"/memory/fuse/:assetId",
async(req,res)=>{

try{

res.json(
await brain.fuse(
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

