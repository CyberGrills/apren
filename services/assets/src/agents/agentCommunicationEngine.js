
function communicate(asset,data){


return [

{
agent:"MARKET_AGENT",
message:"Demand analysis complete",
confidence:90
},

{
agent:"FRESHNESS_AGENT",
message:"Freshness risk evaluated",
confidence:88
},

{
agent:"LOGISTICS_AGENT",
message:"Movement priority calculated",
confidence:85
}

];

}


module.exports={
communicate
};

