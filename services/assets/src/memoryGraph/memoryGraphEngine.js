const graph =
require("./foodGraphEngine");

const relationship =
require("./relationshipEngine");

const query =
require("./knowledgeQueryEngine");


module.exports={
createNode:graph.createNode,
history:graph.history,
connect:relationship.connect,
graph:relationship.graph,
search:query.search
};

