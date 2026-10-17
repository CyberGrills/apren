
const {pool}=require("../postgres");


async function remember(data){


await pool.query(
`
INSERT INTO food_brain_agent_cycles
(
asset_id,
cycle_input,
agent_outputs
)

VALUES
($1,$2,$3)
`,
[
data.assetId,
JSON.stringify(data.input),
JSON.stringify(data.outputs)
]
);


return true;

}


module.exports={
remember
};

