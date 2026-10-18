

function generate(data){


return [

{
name:"SELL_NOW",

description:"Immediate distribution",

freshness:data.freshness,

risk:"LOW_DELAY"
},


{
name:"WAIT",

description:"Hold asset temporarily",

freshness:data.freshness - 20,

risk:"FRESHNESS_LOSS"
},


{
name:"REDIRECT",

description:"Move asset to higher demand",

freshness:data.freshness,

risk:"TRANSPORT_COST"
}


];


}


module.exports={
generate
};


