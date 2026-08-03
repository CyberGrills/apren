

const express=require("express");

const router=express.Router();


const execution =
require("../execution/executionGatewayEngine");



router.post(
"/execution/approve/:assetId",
async(req,res)=>{

try{

res.json(
await execution.execute(
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

