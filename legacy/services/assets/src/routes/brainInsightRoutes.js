

const express=require("express");

const router=express.Router();


const gateway =
require("../gateway/foodBrainInsightGateway");



router.post(
"/insight/:assetId",
async(req,res)=>{


try{


res.json(
await gateway.insight(
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


