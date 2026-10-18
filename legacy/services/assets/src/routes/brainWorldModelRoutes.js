
const express=require("express");

const router=express.Router();


const world =
require("../worldmodel/worldModelEngine");


router.post("/world-model/:assetId",async(req,res)=>{

try{

res.json(
await world.imagine(
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

