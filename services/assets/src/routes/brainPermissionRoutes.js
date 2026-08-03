const express=require("express");

const router=express.Router();


const permission =
require("../governance/permissionMemoryEngine");



router.post("/permission/:userId",async(req,res)=>{

try{

const result =
permission.setPermission(
req.params.userId,
req.body.mode
);


res.json({

user_id:req.params.userId,

permission:result

});

}

catch(error){

res.status(500).json({
error:error.message
});

}

});



router.get("/permission/:userId",async(req,res)=>{


res.json({

user_id:req.params.userId,

permission:
permission.getPermission(
req.params.userId
)

});


});


module.exports=router;
