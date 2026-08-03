const {pool}=require("../postgres");


async function build(assetId,events){


const nodes=[];


for(const event of events){


const result =
await pool.query(
`
INSERT INTO food_brain_memory_nodes
(
asset_id,
memory_type,
content
)

VALUES
($1,$2,$3)

RETURNING *
`,
[
assetId,
event.source,
JSON.stringify(event.data)
]
);


nodes.push(result.rows[0]);

}



return nodes;

}



module.exports={
build
};
