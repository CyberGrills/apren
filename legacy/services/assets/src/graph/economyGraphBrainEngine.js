
const node =
require("./graphNodeEngine");

const event =
require("./eventMemoryEngine");

const pattern =
require("./economicPatternEngine");



async function build(assetId,data){


const assetNode =
await node.createNode({

assetId,

type:"FOOD_ASSET",

name:data.name || "UNKNOWN",

data,

importance:90

});



const storedEvent =
await event.record({

assetId,

type:data.event || "MARKET_UPDATE",

data,

impact:data.impact || 50

});



const insight =
pattern.analyze(
[
data.event
]
);



return {

asset_id:assetId,

graph_node:assetNode,

event:storedEvent,

economic_pattern:insight

};


}



module.exports={
build
};

