const collector =
require("./memoryCollector");


const graph =
require("./memoryGraphEngine");


const recall =
require("./memoryRecallEngine");



async function build(assetId){


const events =
await collector.collect(assetId);


const nodes =
await graph.build(
assetId,
events
);


return {

asset_id:assetId,

events_collected:
events.length,

memory_nodes_created:
nodes.length,

nodes

};

}




module.exports={

build,

recall:
recall.recall

};
