
const express=require("express");

const router=express.Router();


const store =
require("../memory/memoryStoreEngine");

const experience =
require("../memory/brainExperienceEngine");



router.post(
"/memory/store/:assetId",
async(req,res)=>{

res.json(
await store.remember(
req.params.assetId,
req.body
)
);

});



router.get(
"/memory/learn/:assetId",
async(req,res)=>{

res.json(
await experience.learn(
req.params.assetId
)
);

});


module.exports=router;

