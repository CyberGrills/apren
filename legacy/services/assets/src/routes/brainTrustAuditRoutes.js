const express=require("express");

const router=express.Router();


const audit=
require("../governance/trustAuditEngine");



router.get("/trust/audit/:userId",async(req,res)=>{


try{


res.json(
await audit.history(
req.params.userId
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
