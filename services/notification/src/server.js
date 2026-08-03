const express = require("express");
const app = express();

app.use(express.json());


const notifications = [
{
 id:1,
 type:"food",
 title:"Tomatoes are high demand near you",
 detail:"Green Acre Farm supply increased today",
 read:false
},
{
 id:2,
 type:"wallet",
 title:"+3 ə earned this week",
 detail:"Your contribution improved food intelligence",
 read:false
},
{
 id:3,
 type:"kitchen",
 title:"Miso & Co. added new meals",
 detail:"Fresh kitchen activity detected",
 read:false
}
];


app.get("/notifications/:userId",(req,res)=>{
 res.json({
   userId:req.params.userId,
   notifications
 });
});


app.post("/notifications/read/:id",(req,res)=>{

 const item =
 notifications.find(
 n=>n.id===Number(req.params.id)
 );

 if(item){
   item.read=true;
 }

 res.json({
   success:true,
   notification:item
 });

});


app.listen(4007,()=>{

 console.log(
 "āprən notification service running on 4007"
 );

});
