

const express=require("express");

const router=express.Router();


const brain =
require("../prediction/predictiveBrain");



router.post(
"/predict/:assetId",
async(req,res)=>{

try{

res.json(
await brain.predict(
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


