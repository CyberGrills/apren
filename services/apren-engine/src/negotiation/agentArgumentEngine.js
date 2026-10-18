
function argue(data){

return [

{
agent:"MARKET_AGENT",
position:"PROMOTE",
reason:{
reason:"HIGH_DEMAND"
},
score:90
},


{
agent:"FRESHNESS_AGENT",
position:"DISTRIBUTE_FAST",
reason:{
reason:"FRESHNESS_DECAY"
},
score:95
},


{
agent:"VALUE_AGENT",
position:"OPTIMIZE_PRICE",
reason:{
reason:"MAX_VALUE"
},
score:85
},


{
agent:"LOGISTICS_AGENT",
position:"LOCAL_MOVE",
reason:{
reason:"REDUCE_DISTANCE"
},
score:88
}

];

}


module.exports={
argue
};

