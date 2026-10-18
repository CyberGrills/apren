
const express=require("express");

const router=express.Router();


const graph =
require("../graph/economyGraphBrainEngine");



router.post(
"/graph/build/:assetId",
async(req,res)=>{

try{

res.json(
await graph.build(
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

