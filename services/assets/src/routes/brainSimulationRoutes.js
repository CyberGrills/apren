
const express=require("express");

const router=express.Router();


const simulation =
require("../simulation/marketSimulationEngineRunner");



router.post("/simulation/run/:assetId",async(req,res)=>{


try{

res.json(
await simulation.run(
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

