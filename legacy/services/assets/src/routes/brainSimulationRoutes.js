

const express=require("express");

const router=express.Router();


const brain =
require("../simulation/simulationBrain");



router.post(
"/simulate/:assetId",
async(req,res)=>{

try{

res.json(
await brain.simulate(
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


