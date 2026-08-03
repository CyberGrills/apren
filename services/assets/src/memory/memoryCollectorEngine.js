
const {pool}=require("../postgres");


async function collect(assetId,data){

const memories=[

{
type:"MARKET",
source:"marketbrain",
data:data.market
},

{
type:"NEGOTIATION",
source:"agentbrain",
data:data.negotiation
},

{
type:"ACTION",
source:"autonomy",
data:data.action
},

{
type:"EXECUTION",
source:"execution",
data:data.execution
}

];


for(const memory of memories){

await pool.query(
`
INSERT INTO food_brain_memory_fusion
(
asset_id,
memory_type,
memory_source,
memory_data,
importance
)

VALUES($1,$2,$3,$4,$5)
`,
[
assetId,
memory.type,
memory.source,
JSON.stringify(memory.data),
80
]
);

}


return memories;

}


module.exports={
collect
};

