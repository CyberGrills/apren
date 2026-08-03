
const express=require("express");

const router=express.Router();


const strategy =
require("../strategy/adaptiveStrategyEngine");



router.post(
"/strategy/evolve/:assetId",
async(req,res)=>{

try{

res.json(
await strategy.adapt(
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

